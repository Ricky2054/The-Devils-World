// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title AVAX Staking Contract — Devil's World Enhanced
 * @dev  Tiered APY + 5% treasury fee on rewards + game-score multiplier
 *
 *  Tier system (based on how long the current stake has been active):
 *    Bronze  :  0 – 6 days    → 10% APY
 *    Silver  :  7 – 29 days   → 15% APY
 *    Gold    :  30+ days      → 20% APY
 *
 *  Score multiplier (set by game server, max 2×):
 *    Stored as basis points: 10000 = 1×, 15000 = 1.5×, 20000 = 2×.
 *    Active players are rewarded directly in their staking returns.
 *
 *  Treasury fee:
 *    5% of every reward payment → treasury wallet (developer).
 *    Principal is ALWAYS returned 100% to the staker.
 */
contract AVAXStaking {
    // ─── Events ────────────────────────────────────────────────────────────────
    event Staked(address indexed user, uint256 amount, uint256 timestamp);
    event Unstaked(address indexed user, uint256 amount, uint256 timestamp);
    event RewardsClaimed(address indexed user, uint256 netReward, uint256 fee, uint256 timestamp);
    event TierChanged(address indexed user, string tier);
    event ScoreMultiplierUpdated(address indexed user, uint256 multiplierBps);
    event TreasuryFeeCollected(address indexed treasury, uint256 amount, uint256 timestamp);
    event EmergencyWithdraw(address indexed owner, uint256 amount, uint256 timestamp);

    // ─── Structs ───────────────────────────────────────────────────────────────
    struct Staker {
        uint256 stakedAmount;
        uint256 stakingTimestamp;   // start of current stake (used for tier calc)
        uint256 lastRewardClaim;
        bool    isStaking;
    }

    // ─── Constants ──────────────────────────────────────────────────────────────
    uint256 public constant MINIMUM_STAKE    = 0.001 ether;
    uint256 public constant BRONZE_APY       = 10;    // 10% APY  (0–6 days)
    uint256 public constant SILVER_APY       = 15;    // 15% APY  (7–29 days)
    uint256 public constant GOLD_APY         = 20;    // 20% APY  (30+ days)
    uint256 public constant SILVER_THRESHOLD = 7 days;
    uint256 public constant GOLD_THRESHOLD   = 30 days;
    uint256 public constant TREASURY_FEE_BPS = 500;   // 5 % in basis points
    uint256 public constant BPS_DENOMINATOR  = 10000;
    uint256 public constant MAX_MULTIPLIER   = 20000; // 2× cap

    // ─── State variables ────────────────────────────────────────────────────────
    mapping(address => Staker)  public stakers;
    mapping(address => uint256) public scoreMultiplierBps; // 10000 = 1× (default)

    address public owner;
    address public treasury;

    uint256 public totalStaked;
    uint256 public totalRewardsPaid;
    uint256 public totalTreasuryCollected;
    bool    public stakingPaused;

    // ─── Modifiers ─────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    modifier whenNotPaused() {
        require(!stakingPaused, "Staking is currently paused");
        _;
    }

    modifier validStake() {
        require(msg.value >= MINIMUM_STAKE, "Minimum stake is 0.001 AVAX");
        _;
    }

    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address _treasury) {
        owner    = msg.sender;
        treasury = _treasury != address(0) ? _treasury : msg.sender;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  STAKING
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Stake AVAX tokens.  One active stake per address.
     * @notice Users can stake minimum 0.001 AVAX
     */
    function stake() external payable whenNotPaused validStake {
        require(!stakers[msg.sender].isStaking, "Already staking - call addToStake");

        stakers[msg.sender] = Staker({
            stakedAmount:     msg.value,
            stakingTimestamp: block.timestamp,
            lastRewardClaim:  block.timestamp,
            isStaking:        true
        });

        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @dev Add more AVAX to an existing stake.
     *      Settles pending rewards first (compounding), then resets tier clock.
     */
    function addToStake() external payable whenNotPaused validStake {
        require(stakers[msg.sender].isStaking, "Not staking yet - call stake()");
        _settleRewards(msg.sender);
        stakers[msg.sender].stakedAmount     += msg.value;
        stakers[msg.sender].stakingTimestamp  = block.timestamp; // tier restarts
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value, block.timestamp);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  WITHDRAWAL
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Unstake AVAX tokens.
     * @notice Principal returned 100%.  5% treasury fee deducted from rewards only.
     */
    function unstake() external {
        require(stakers[msg.sender].isStaking, "Not staking");

        Staker storage s = stakers[msg.sender];
        uint256 principal = s.stakedAmount;

        // Settle reward BEFORE clearing state
        _settleRewards(msg.sender);

        delete stakers[msg.sender];
        totalStaked -= principal;

        // Return 100% principal to player
        (bool ok, ) = payable(msg.sender).call{value: principal}("");
        require(ok, "Principal transfer failed");

        emit Unstaked(msg.sender, principal, block.timestamp);
    }

    /**
     * @dev Claim rewards without unstaking.
     * @notice Users can claim accumulated rewards
     */
    function claimRewards() external {
        require(stakers[msg.sender].isStaking, "Not staking");
        uint256 gross = calculateRewards(msg.sender);
        require(gross > 0, "No rewards to claim");
        _settleRewards(msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  INTERNAL — reward settlement
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Compute gross reward, split 5% to treasury, remainder to staker.
     *      Updates lastRewardClaim.  Returns net reward paid to player.
     */
    function _settleRewards(address player) internal returns (uint256 netReward) {
        uint256 gross = calculateRewards(player);
        if (gross == 0) return 0;

        uint256 fee = (gross * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        netReward   = gross - fee;

        stakers[player].lastRewardClaim  = block.timestamp;
        totalRewardsPaid                += gross;
        totalTreasuryCollected          += fee;

        // Send treasury fee
        if (fee > 0 && address(this).balance >= fee) {
            (bool t, ) = payable(treasury).call{value: fee}("");
            require(t, "Treasury transfer failed");
            emit TreasuryFeeCollected(treasury, fee, block.timestamp);
        }

        // Send net reward to player
        if (netReward > 0 && address(this).balance >= netReward) {
            (bool p, ) = payable(player).call{value: netReward}("");
            require(p, "Reward transfer failed");
            emit RewardsClaimed(player, netReward, fee, block.timestamp);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  REWARD CALCULATION  (tier × score multiplier)
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Calculate pending rewards for a staker (gross, before treasury fee).
     * @param stakerAddress Address of the staker
     * @return Gross pending rewards
     */
    function calculateRewards(address stakerAddress) public view returns (uint256) {
        Staker memory s = stakers[stakerAddress];
        if (!s.isStaking) return 0;

        uint256 duration      = block.timestamp - s.lastRewardClaim;
        uint256 apy           = _tierAPY(s.stakingTimestamp);
        uint256 multiplierBps = scoreMultiplierBps[stakerAddress];
        if (multiplierBps == 0) multiplierBps = BPS_DENOMINATOR; // default 1×

        // base = stakedAmount × APY% × duration / (365days × 100)
        uint256 base = (s.stakedAmount * apy * duration) / (365 days * 100);
        // apply score multiplier (max 2×)
        return (base * multiplierBps) / BPS_DENOMINATOR;
    }

    /**
     * @notice Returns net reward and fee breakdown for the UI.
     */
    function calculateNetRewards(address stakerAddress) external view returns (uint256 net, uint256 fee) {
        uint256 gross = calculateRewards(stakerAddress);
        fee = (gross * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        net = gross - fee;
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    function _tierAPY(uint256 stakingTimestamp) internal view returns (uint256) {
        uint256 age = block.timestamp - stakingTimestamp;
        if (age >= GOLD_THRESHOLD)   return GOLD_APY;
        if (age >= SILVER_THRESHOLD) return SILVER_APY;
        return BRONZE_APY;
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  GAME SCORE MULTIPLIER
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Game server calls this to reward active players with a higher multiplier.
     *         multiplierBps: 10000 = 1×, 15000 = 1.5×, 20000 = 2× (hard cap).
     */
    function setPlayerScoreMultiplier(address player, uint256 multiplierBps) external onlyOwner {
        require(multiplierBps >= BPS_DENOMINATOR, "Multiplier must be >= 1x (10000)");
        require(multiplierBps <= MAX_MULTIPLIER,  "Multiplier capped at 2x (20000)");
        scoreMultiplierBps[player] = multiplierBps;
        emit ScoreMultiplierUpdated(player, multiplierBps);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  VIEW HELPERS
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns human-readable tier label for a staker.
     */
    function getStakerTier(address stakerAddress) external view returns (string memory) {
        Staker memory s = stakers[stakerAddress];
        if (!s.isStaking) return "None";
        uint256 age = block.timestamp - s.stakingTimestamp;
        if (age >= GOLD_THRESHOLD)   return "Gold";
        if (age >= SILVER_THRESHOLD) return "Silver";
        return "Bronze";
    }

    /**
     * @dev Get staker information
     * @param stakerAddress Address of the staker
     */
    function getStakerInfo(address stakerAddress) external view returns (
        uint256 stakedAmount,
        uint256 stakingTimestamp,
        uint256 pendingRewards,
        bool    isStaking,
        string memory tier,
        uint256 multiplierBps_,
        uint256 currentAPY
    ) {
        Staker memory s = stakers[stakerAddress];
        stakedAmount     = s.stakedAmount;
        stakingTimestamp = s.stakingTimestamp;
        pendingRewards   = calculateRewards(stakerAddress);
        isStaking        = s.isStaking;
        multiplierBps_   = scoreMultiplierBps[stakerAddress] == 0
                           ? BPS_DENOMINATOR
                           : scoreMultiplierBps[stakerAddress];
        currentAPY       = s.isStaking ? _tierAPY(s.stakingTimestamp) : 0;

        uint256 age = s.isStaking ? block.timestamp - s.stakingTimestamp : 0;
        if (!s.isStaking)               tier = "None";
        else if (age >= GOLD_THRESHOLD)   tier = "Gold";
        else if (age >= SILVER_THRESHOLD) tier = "Silver";
        else                              tier = "Bronze";
    }

    /**
     * @dev Get contract statistics
     */
    function getContractStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalRewardsPaid,
        uint256 _totalTreasuryCollected,
        uint256 contractBalance
    ) {
        return (totalStaked, totalRewardsPaid, totalTreasuryCollected, address(this).balance);
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  ADMIN
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @dev Set the treasury wallet that receives 5% of all reward payouts.
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    /**
     * @dev Pause staking (only owner)
     */
    function pauseStaking() external onlyOwner {
        stakingPaused = true;
    }

    /**
     * @dev Unpause staking (only owner)
     */
    function unpauseStaking() external onlyOwner {
        stakingPaused = false;
    }

    /**
     * @dev Emergency withdraw (only owner)
     * @notice Only for emergency situations
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");

        emit EmergencyWithdraw(owner, balance, block.timestamp);
    }

    /**
     * @dev Add funds to contract for rewards (only owner)
     * @notice Owner can add AVAX to fund rewards
     */
    function fundRewards() external payable onlyOwner {
        require(msg.value > 0, "Must send AVAX to fund rewards");
    }

    /**
     * @dev Receive function to accept AVAX
     */
    receive() external payable {}

    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}
