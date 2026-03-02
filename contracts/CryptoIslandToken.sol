// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Crypto Island Token (CIT) — Enhanced
 * @dev  ERC-20 token with tiered staking APY, game-score multiplier, and 5% treasury fee on rewards.
 *
 *  Tier system (based on how long the current CIT stake has been active):
 *    Bronze  :  0 – 6 days    → 10% APY
 *    Silver  :  7 – 29 days   → 15% APY
 *    Gold    :  30+ days      → 20% APY
 *
 *  Score multiplier (set by game/owner, max 2×):
 *    10000 BPS = 1×,  20000 BPS = 2× (max).
 *
 *  Treasury fee:
 *    5% of every CIT reward mint goes to the treasury wallet.
 *    Principal CIT is ALWAYS returned 100% to the staker.
 */
contract CryptoIslandToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    // ─── Supply constants ──────────────────────────────────────────────────────
    uint256 public constant INITIAL_SUPPLY = 1_000_000 * 10**18;
    uint256 public constant MAX_SUPPLY     = 10_000_000 * 10**18;
    uint256 public constant MINT_PRICE     = 0.001 ether; // AVAX per CIT

    // ─── Staking tier thresholds ───────────────────────────────────────────────
    uint256 public constant BRONZE_APY       = 10;
    uint256 public constant SILVER_APY       = 15;
    uint256 public constant GOLD_APY         = 20;
    uint256 public constant SILVER_THRESHOLD = 7 days;
    uint256 public constant GOLD_THRESHOLD   = 30 days;
    uint256 public constant REWARD_INTERVAL  = 365 days;

    // ─── Treasury / multiplier ─────────────────────────────────────────────────
    uint256 public constant TREASURY_FEE_BPS = 500;   // 5%
    uint256 public constant BPS_DENOMINATOR  = 10000;
    uint256 public constant MAX_MULTIPLIER   = 20000; // 2× cap

    address public treasury;

    // ─── Staker struct ─────────────────────────────────────────────────────────
    struct StakerInfo {
        uint256 stakedAmount;
        uint256 stakingTimestamp;  // start of current stake (for tier calc)
        bool    isStaking;
    }

    mapping(address => StakerInfo) public stakers;
    mapping(address => uint256)    public scoreMultiplierBps; // 10000 = 1× (default)
    mapping(address => bool)       public gameContracts;
    mapping(address => uint256)    public gameRewards;

    uint256 public totalStaked;
    uint256 public totalTreasuryCollected;

    // ─── Events ────────────────────────────────────────────────────────────────
    event TokensMinted(address indexed to, uint256 amount, uint256 timestamp);
    event TokensStaked(address indexed staker, uint256 amount, uint256 timestamp);
    event TokensUnstaked(address indexed staker, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed staker, uint256 netReward, uint256 fee, uint256 timestamp);
    event TreasuryFeeCollected(address indexed treasury, uint256 amount, uint256 timestamp);
    event ScoreMultiplierUpdated(address indexed player, uint256 multiplierBps);
    event GameRewardEarned(address indexed player, uint256 amount, string gameAction);

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyGameContract() {
        require(gameContracts[msg.sender], "Only game contracts");
        _;
    }

    modifier validMint(uint256 amount) {
        require(amount > 0, "Amount must be > 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address _treasury)
        ERC20("Crypto Island Token", "CIT")
        Ownable(msg.sender)
    {
        treasury = _treasury != address(0) ? _treasury : msg.sender;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  MINTING
    // ──────────────────────────────────────────────────────────────────────────

    function initializeSupply(address to) external onlyOwner {
        require(totalSupply() == 0, "Already initialized");
        _mint(to, INITIAL_SUPPLY);
    }

    function mintTokens(address to, uint256 amount) external onlyOwner {
        uint256 scaled = amount * 10**decimals();
        require(amount > 0, "Amount must be > 0");
        require(totalSupply() + scaled <= MAX_SUPPLY, "Max supply exceeded");
        _mint(to, scaled);
        emit TokensMinted(to, scaled, block.timestamp);
    }

    function mintWithAVAX(uint256 amount) external payable whenNotPaused {
        uint256 scaled = amount * 10**decimals();
        require(amount > 0, "Amount must be > 0");
        require(totalSupply() + scaled <= MAX_SUPPLY, "Max supply exceeded");
        require(msg.value >= amount * MINT_PRICE, "Insufficient AVAX");
        _mint(msg.sender, scaled);
        emit TokensMinted(msg.sender, scaled, block.timestamp);
        uint256 expected = amount * MINT_PRICE;
        if (msg.value > expected) {
            (bool ok, ) = payable(msg.sender).call{value: msg.value - expected}("");
            require(ok, "Refund failed");
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  CIT STAKING
    // ──────────────────────────────────────────────────────────────────────────

    function stakeTokens(uint256 amount) external whenNotPaused nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        if (stakers[msg.sender].isStaking) {
            _claimRewardsInternal(msg.sender);
        }
        _transfer(msg.sender, address(this), amount);
        stakers[msg.sender].stakedAmount     += amount;
        stakers[msg.sender].stakingTimestamp  = block.timestamp;
        stakers[msg.sender].isStaking         = true;
        totalStaked += amount;
        emit TokensStaked(msg.sender, amount, block.timestamp);
    }

    /**
     * @notice Unstake CIT.  Principal returned 100%.
     *         5% treasury fee is taken only from the reward portion.
     */
    function unstakeTokens() external whenNotPaused nonReentrant {
        require(stakers[msg.sender].isStaking, "Not staking");
        uint256 principal = stakers[msg.sender].stakedAmount;
        require(principal > 0, "No tokens staked");

        // Settle rewards (net of fee) before clearing state
        _claimRewardsInternal(msg.sender);

        stakers[msg.sender].stakedAmount     = 0;
        stakers[msg.sender].stakingTimestamp = 0;
        stakers[msg.sender].isStaking        = false;
        totalStaked -= principal;

        // Return 100% principal
        _transfer(address(this), msg.sender, principal);
        emit TokensUnstaked(msg.sender, principal, block.timestamp);
    }

    function claimRewards() external whenNotPaused nonReentrant {
        require(stakers[msg.sender].isStaking, "Not staking");
        uint256 gross = calculateRewards(msg.sender);
        require(gross > 0, "No rewards");
        _claimRewardsInternal(msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  INTERNAL — reward settlement
    // ──────────────────────────────────────────────────────────────────────────

    function _claimRewardsInternal(address stakerAddr) internal {
        uint256 gross = calculateRewards(stakerAddr);
        if (gross == 0) return;

        uint256 fee    = (gross * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        uint256 net    = gross - fee;

        // Reset staking timestamp so tier clock restarts
        stakers[stakerAddr].stakingTimestamp = block.timestamp;
        totalTreasuryCollected += fee;

        // Mint fee to treasury
        if (fee > 0 && totalSupply() + fee <= MAX_SUPPLY) {
            _mint(treasury, fee);
            emit TreasuryFeeCollected(treasury, fee, block.timestamp);
        }

        // Mint net reward to staker
        if (net > 0 && totalSupply() + net <= MAX_SUPPLY) {
            _mint(stakerAddr, net);
        }

        emit RewardsClaimed(stakerAddr, net, fee, block.timestamp);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  REWARD CALCULATION  (tier × score multiplier)
    // ──────────────────────────────────────────────────────────────────────────

    function calculateRewards(address stakerAddr) public view returns (uint256) {
        StakerInfo memory info = stakers[stakerAddr];
        if (!info.isStaking || info.stakedAmount == 0) return 0;

        uint256 duration      = block.timestamp - info.stakingTimestamp;
        uint256 apy           = _tierAPY(info.stakingTimestamp);
        uint256 multiplierBps = scoreMultiplierBps[stakerAddr];
        if (multiplierBps == 0) multiplierBps = BPS_DENOMINATOR;

        uint256 base = (info.stakedAmount * apy * duration) / (100 * REWARD_INTERVAL);
        return (base * multiplierBps) / BPS_DENOMINATOR;
    }

    function calculateNetRewards(address stakerAddr) external view returns (uint256 net, uint256 fee) {
        uint256 gross = calculateRewards(stakerAddr);
        fee = (gross * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        net = gross - fee;
    }

    function _tierAPY(uint256 stakingTimestamp) internal view returns (uint256) {
        uint256 age = block.timestamp - stakingTimestamp;
        if (age >= GOLD_THRESHOLD)   return GOLD_APY;
        if (age >= SILVER_THRESHOLD) return SILVER_APY;
        return BRONZE_APY;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  SCORE MULTIPLIER
    // ──────────────────────────────────────────────────────────────────────────

    function setPlayerScoreMultiplier(address player, uint256 multiplierBps) external onlyOwner {
        require(multiplierBps >= BPS_DENOMINATOR, "Must be >= 1x (10000)");
        require(multiplierBps <= MAX_MULTIPLIER,  "Capped at 2x (20000)");
        scoreMultiplierBps[player] = multiplierBps;
        emit ScoreMultiplierUpdated(player, multiplierBps);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  VIEW HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    function getStakerTier(address stakerAddr) external view returns (string memory) {
        StakerInfo memory s = stakers[stakerAddr];
        if (!s.isStaking) return "None";
        uint256 age = block.timestamp - s.stakingTimestamp;
        if (age >= GOLD_THRESHOLD)   return "Gold";
        if (age >= SILVER_THRESHOLD) return "Silver";
        return "Bronze";
    }

    function getStakerInfo(address stakerAddr) external view returns (
        uint256 stakedAmount,
        uint256 stakingTimestamp,
        uint256 pendingRewards,
        bool    isStaking,
        string memory tier,
        uint256 multiplierBps_,
        uint256 currentAPY
    ) {
        StakerInfo memory s = stakers[stakerAddr];
        stakedAmount     = s.stakedAmount;
        stakingTimestamp = s.stakingTimestamp;
        pendingRewards   = calculateRewards(stakerAddr);
        isStaking        = s.isStaking;
        multiplierBps_   = scoreMultiplierBps[stakerAddr] == 0
                           ? BPS_DENOMINATOR : scoreMultiplierBps[stakerAddr];
        currentAPY       = s.isStaking ? _tierAPY(s.stakingTimestamp) : 0;

        uint256 age = s.isStaking ? block.timestamp - s.stakingTimestamp : 0;
        if (!s.isStaking)               tier = "None";
        else if (age >= GOLD_THRESHOLD)   tier = "Gold";
        else if (age >= SILVER_THRESHOLD) tier = "Silver";
        else                              tier = "Bronze";
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  GAME CONTRACT HOOKS
    // ──────────────────────────────────────────────────────────────────────────

    function earnGameReward(address player, uint256 amount, string memory gameAction)
        external onlyGameContract
    {
        require(amount > 0, "Amount must be > 0");
        require(totalSupply() + amount <= MAX_SUPPLY, "Max supply exceeded");
        _mint(player, amount);
        gameRewards[player] += amount;
        emit GameRewardEarned(player, amount, gameAction);
    }

    function spendGameTokens(address player, uint256 amount) external onlyGameContract {
        require(amount > 0, "Amount must be > 0");
        _transfer(player, address(this), amount);
    }

    function addGameContract(address gameContract) external onlyOwner {
        gameContracts[gameContract] = true;
    }

    function removeGameContract(address gameContract) external onlyOwner {
        gameContracts[gameContract] = false;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  ADMIN
    // ──────────────────────────────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function withdrawAVAX() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "No AVAX");
        (bool ok, ) = payable(owner()).call{value: bal}("");
        require(ok, "Withdraw failed");
    }
}