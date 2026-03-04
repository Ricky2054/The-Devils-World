// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Devil's World On-Chain Leaderboard
 * @dev   Stores player game stats on Avalanche Fuji testnet.
 *        Stats are submitted when a player mints an achievement NFT.
 *        Anyone can read the full leaderboard — it is fully public and cross-device.
 */
contract DevilWorldLeaderboard {
    // ─── Events ────────────────────────────────────────────────────────────────
    event ScoreSubmitted(address indexed player, uint256 score, uint256 kills, uint256 gold, uint256 level, uint256 timestamp);

    // ─── Structs ───────────────────────────────────────────────────────────────
    struct PlayerScore {
        address player;
        uint256 score;
        uint256 kills;
        uint256 gold;
        uint256 level;
        uint256 timestamp;
    }

    // ─── State ─────────────────────────────────────────────────────────────────
    address public owner;
    mapping(address => PlayerScore) public playerBestScores;
    address[] public playerList;
    mapping(address => bool) private isRegistered;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ─── Submit score (anyone can call — player submits their own stats) ─────
    function submitScore(
        uint256 _score,
        uint256 _kills,
        uint256 _gold,
        uint256 _level
    ) external {
        // If new best score, or first-time submission, update
        if (_score >= playerBestScores[msg.sender].score) {
            playerBestScores[msg.sender] = PlayerScore({
                player: msg.sender,
                score: _score,
                kills: _kills,
                gold: _gold,
                level: _level,
                timestamp: block.timestamp
            });
        }

        // Register player if not already in the list
        if (!isRegistered[msg.sender]) {
            isRegistered[msg.sender] = true;
            playerList.push(msg.sender);
        }

        emit ScoreSubmitted(msg.sender, _score, _kills, _gold, _level, block.timestamp);
    }

    // ─── Read helpers ──────────────────────────────────────────────────────────

    /// @notice Returns total number of unique players
    function getPlayerCount() external view returns (uint256) {
        return playerList.length;
    }

    /// @notice Returns a player's best score entry
    function getPlayerScore(address _player) external view returns (PlayerScore memory) {
        return playerBestScores[_player];
    }

    /// @notice Returns the top N players sorted by score (descending).
    ///         Sorting is done off-chain for gas efficiency; this returns raw data.
    function getAllScores() external view returns (PlayerScore[] memory) {
        uint256 count = playerList.length;
        PlayerScore[] memory scores = new PlayerScore[](count);
        for (uint256 i = 0; i < count; i++) {
            scores[i] = playerBestScores[playerList[i]];
        }
        return scores;
    }

    /// @notice Returns a page of players (for large lists)
    function getScoresPage(uint256 _offset, uint256 _limit) external view returns (PlayerScore[] memory) {
        uint256 count = playerList.length;
        if (_offset >= count) {
            return new PlayerScore[](0);
        }
        uint256 end = _offset + _limit;
        if (end > count) end = count;
        uint256 size = end - _offset;
        PlayerScore[] memory page = new PlayerScore[](size);
        for (uint256 i = 0; i < size; i++) {
            page[i] = playerBestScores[playerList[_offset + i]];
        }
        return page;
    }

    // ─── Admin ─────────────────────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }
}
