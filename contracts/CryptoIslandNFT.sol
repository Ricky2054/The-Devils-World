// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title Crypto Island NFT Collection — Enhanced
 * @dev  Simple NFT contract for Crypto Island Adventure Game.
 *       5% of every mint payment is forwarded to the treasury (developer wallet) at mint time.
 *       Remaining 95% accumulates in the contract for owner withdrawal.
 */
contract CryptoIslandNFT {
    // ─── Events ────────────────────────────────────────────────────────────────
    event NFTMinted(address indexed to, uint256 tokenId, uint256 timestamp);
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event TreasuryFeeCollected(address indexed treasury, uint256 amount, uint256 timestamp);
    
    // ─── State variables ────────────────────────────────────────────────────────
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    string private _name = "Crypto Island Adventure";
    string private _symbol = "CIA";
    string private _baseTokenURI = "https://crypto-island-adventure.com/metadata/";
    
    uint256 private _tokenIdCounter;
    uint256 public constant MINT_PRICE        = 0.0005 ether; // 0.0005 AVAX
    uint256 public constant MAX_SUPPLY        = 10000;
    uint256 public constant TREASURY_FEE_BPS  = 500;   // 5% of each mint
    uint256 public constant BPS_DENOMINATOR   = 10000;
    bool    public mintingPaused              = false;
    address public owner;
    address public treasury;

    uint256 public totalTreasuryCollected;
    uint256 public totalMintRevenue;
    
    // NFT metadata
    struct NFTMetadata {
        string name;
        string description;
        string image;
        string[] attributes;
    }
    
    mapping(uint256 => NFTMetadata) public tokenMetadata;
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier whenNotPaused() {
        require(!mintingPaused, "Minting is currently paused");
        _;
    }
    
    modifier validMint() {
        require(msg.value >= MINT_PRICE, "Insufficient payment for minting");
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        _;
    }
    
    // ─── Constructor ───────────────────────────────────────────────────────────
    constructor(address _treasury) {
        owner    = msg.sender;
        treasury = _treasury != address(0) ? _treasury : msg.sender;
    }
    
    // ─── Mint NFT ──────────────────────────────────────────────────────────────
    function mintNFT() external payable whenNotPaused validMint {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _mint(msg.sender, tokenId);
        
        // Set metadata
        tokenMetadata[tokenId] = NFTMetadata({
            name: string(abi.encodePacked("Crypto Island NFT #", _toString(tokenId))),
            description: "A unique NFT from the Crypto Island Adventure game. This NFT represents your journey in the digital revolution.",
            image: string(abi.encodePacked(_baseTokenURI, _toString(tokenId), ".png")),
            attributes: _generateAttributes(tokenId)
        });

        // ── Treasury fee: 5% of mint price → treasury (dev wallet) ──
        uint256 fee = (MINT_PRICE * TREASURY_FEE_BPS) / BPS_DENOMINATOR;
        totalTreasuryCollected += fee;
        totalMintRevenue       += msg.value;
        if (fee > 0) {
            (bool t, ) = payable(treasury).call{value: fee}("");
            require(t, "Treasury fee transfer failed");
            emit TreasuryFeeCollected(treasury, fee, block.timestamp);
        }

        // Refund any overpayment
        if (msg.value > MINT_PRICE) {
            (bool r, ) = payable(msg.sender).call{value: msg.value - MINT_PRICE}("");
            require(r, "Refund failed");
        }
        
        emit NFTMinted(msg.sender, tokenId, block.timestamp);
    }
    
    // Mint NFT to specific address (only owner)
    function mintTo(address to) external onlyOwner {
        require(_tokenIdCounter < MAX_SUPPLY, "Max supply reached");
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _mint(to, tokenId);
        
        // Set metadata
        tokenMetadata[tokenId] = NFTMetadata({
            name: string(abi.encodePacked("Crypto Island NFT #", _toString(tokenId))),
            description: "A unique NFT from the Crypto Island Adventure game. This NFT represents your journey in the digital revolution.",
            image: string(abi.encodePacked(_baseTokenURI, _toString(tokenId), ".png")),
            attributes: _generateAttributes(tokenId)
        });
        
        emit NFTMinted(to, tokenId, block.timestamp);
    }
    
    // Get total supply
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }
    
    // Get balance
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }
    
    // Get owner of token
    function ownerOf(uint256 tokenId) external view returns (address) {
        return _owners[tokenId];
    }
    
    // Get token URI
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId), ".json"));
    }
    
    // Get NFT metadata
    function getNFTMetadata(uint256 tokenId) external view returns (NFTMetadata memory) {
        require(_exists(tokenId), "Token does not exist");
        return tokenMetadata[tokenId];
    }
    
    // Get max supply
    function getMaxSupply() external pure returns (uint256) {
        return MAX_SUPPLY;
    }
    
    // Get mint price
    function getMintPrice() external pure returns (uint256) {
        return MINT_PRICE;
    }
    
    // Set base URI (only owner)
    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }
    
    // Pause minting
    function pauseMinting() external onlyOwner {
        mintingPaused = true;
    }
    
    // Unpause minting
    function unpauseMinting() external onlyOwner {
        mintingPaused = false;
    }

    // Update treasury wallet (only owner)
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }
    
    // Withdraw accumulated (95%) mint revenue to owner
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Transfer failed");
    }
    
    // Internal functions
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _owners[tokenId] != address(0);
    }
    
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        require(!_exists(tokenId), "Token already minted");
        
        _balances[to]++;
        _owners[tokenId] = to;
        
        emit Transfer(address(0), to, tokenId);
    }
    
    function _generateAttributes(uint256 tokenId) private pure returns (string[] memory) {
        string[] memory attributes = new string[](4);
        
        // Generate attributes based on tokenId
        attributes[0] = string(abi.encodePacked("Rarity: ", _getRarity(tokenId)));
        attributes[1] = string(abi.encodePacked("Power: ", _getPower(tokenId)));
        attributes[2] = string(abi.encodePacked("Element: ", _getElement(tokenId)));
        attributes[3] = string(abi.encodePacked("Generation: ", _getGeneration(tokenId)));
        
        return attributes;
    }
    
    function _getRarity(uint256 tokenId) private pure returns (string memory) {
        uint256 rarity = tokenId % 5;
        if (rarity == 0) return "Common";
        if (rarity == 1) return "Uncommon";
        if (rarity == 2) return "Rare";
        if (rarity == 3) return "Epic";
        return "Legendary";
    }
    
    function _getPower(uint256 tokenId) private pure returns (string memory) {
        uint256 power = (tokenId % 100) + 1;
        return _toString(power);
    }
    
    function _getElement(uint256 tokenId) private pure returns (string memory) {
        uint256 element = tokenId % 4;
        if (element == 0) return "Fire";
        if (element == 1) return "Water";
        if (element == 2) return "Earth";
        return "Air";
    }
    
    function _getGeneration(uint256 tokenId) private pure returns (string memory) {
        uint256 generation = (tokenId / 1000) + 1;
        return _toString(generation);
    }
    
    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    // Receive function
    receive() external payable {}
}