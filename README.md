# 😈 Devil World - Smart Contracts

Real smart contracts for the Devil World game, deployed on Avalanche Fuji testnet.

## 📋 Contracts Overview

### 🏦 Native Token Staking Contract
- **Minimum Stake**: 0.001 native tokens
- **Reward Rate**: 10% APY
- **Features**: Staking, unstaking, reward claiming, emergency functions

### 🎨 Crypto Island NFT Contract
- **Mint Price**: 0.0005 native tokens
- **Max Supply**: 10,000 NFTs
- **Features**: NFT minting, metadata, rarity system, owner controls

## 🚀 Quick Start

### ▶️ Run Commands (Simple)

```bash
# 1) Install dependencies
npm install

# 2) Start game (development)
npm start

# 3) Production build
npm run build
```

Open http://localhost:3000 after `npm start`.

### Prerequisites
- Node.js (v16+)
- npm or yarn
- MetaMask with Avalanche Fuji testnet configured
- Native tokens for gas fees and staking

### Installation
```bash
# Install dependencies
npm install

# Compile contracts
npm run compile

# Run smart contract tests
npx hardhat test
```

### Deployment

#### 1. Set up environment variables
Create a `.env` file:
```env
PRIVATE_KEY=your_private_key_here
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
BLOCK_EXPLORER_API_KEY=your_block_explorer_api_key_here
```

#### 2. Deploy to Avalanche Fuji Testnet
```bash
npm run deploy:fuji
```

#### 3. Verify contracts (optional)
> Contract verification command is optional and can be added with Snowtrace API setup.

## 📝 Contract Addresses

### 🚀 Deployed Contracts on Avalanche Fuji Testnet

```javascript
// Native Token Staking Contract
const STAKING_CONTRACT = "0x961474F7615b2ecc02feF01c6c83042628648C68";

// Crypto Island NFT Contract  
const NFT_CONTRACT = "0x591219308029e3AC0B5068DB628e7DAD716a5ab2";

// Crypto Island Token Contract (ERC-20)
const TOKEN_CONTRACT = "0xd66487C006D8eF71512244eD8f9fA5377F65D208";
```

### 🔗 Block Explorer Links
- **Staking Contract**: `https://testnet.snowtrace.io/address/0x961474F7615b2ecc02feF01c6c83042628648C68`
- **NFT Contract**: `https://testnet.snowtrace.io/address/0x591219308029e3AC0B5068DB628e7DAD716a5ab2`
- **Token Contract**: `https://testnet.snowtrace.io/address/0xd66487C006D8eF71512244eD8f9fA5377F65D208`

## 🎮 Game Integration

Update your game with the deployed contract addresses:

```javascript
// In your game's App.js - Use the actual deployed addresses
const STAKING_CONTRACT = "0x961474F7615b2ecc02feF01c6c83042628648C68";
const NFT_CONTRACT = "0x591219308029e3AC0B5068DB628e7DAD716a5ab2";
const TOKEN_CONTRACT = "0xd66487C006D8eF71512244eD8f9fA5377F65D208";

// Update staking function
const stakeCoins = async () => {
  // ... existing code ...
  
  const tx = await signer.sendTransaction({
    to: STAKING_CONTRACT, // Real deployed contract address
    value: stakeAmount,
    gasLimit: gasEstimate.mul(120).div(100)
  });
  
  // ... rest of function ...
};

// Update NFT minting function
const mintNFT = async () => {
  // ... existing code ...
  
  const tx = await signer.sendTransaction({
    to: NFT_CONTRACT, // Real deployed contract address
    value: mintAmount,
    gasLimit: gasEstimate.mul(120).div(100)
  });
  
  // ... rest of function ...
};
```

## 🔧 Contract Functions

### Native Token Staking Contract
```solidity
// Stake native tokens
function stake() external payable

// Unstake native tokens
function unstake() external

// Claim rewards
function claimRewards() external

// Get staker info
function getStakerInfo(address stakerAddress) external view returns (...)
```

### NFT Contract
```solidity
// Mint NFT
function mintNFT() external payable

// Get NFT metadata
function getNFTMetadata(uint256 tokenId) external view returns (...)
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Tests cover:
- ✅ Staking functionality
- ✅ NFT minting
- ✅ Reward calculations
- ✅ Contract integration
- ✅ Error handling

## 📊 Contract Statistics

After deployment, check contract stats:
- **Total Staked**: Amount of native tokens staked
- **Total Rewards Paid**: Rewards distributed
- **NFTs Minted**: Number of NFTs created
- **Contract Balance**: Available funds

## 🔍 Verification

Contracts are verifiable on Snowtrace testnet:
- **Staking Contract**: `https://testnet.snowtrace.io/address/0x961474F7615b2ecc02feF01c6c83042628648C68`
- **NFT Contract**: `https://testnet.snowtrace.io/address/0x591219308029e3AC0B5068DB628e7DAD716a5ab2`
- **Token Contract**: `https://testnet.snowtrace.io/address/0xd66487C006D8eF71512244eD8f9fA5377F65D208`

## 🛡️ Security Features

- **Access Control**: Owner-only functions
- **Pause Mechanism**: Emergency pause functionality
- **Input Validation**: Proper parameter validation
- **Reentrancy Protection**: Safe external calls
- **Overflow Protection**: Safe math operations

## 📈 Gas Optimization

- **Optimized Solidity**: Version 0.8.19 with optimizations
- **Efficient Storage**: Minimal storage operations
- **Batch Operations**: Reduced transaction costs
- **Gas Estimation**: Accurate gas calculations

## 🎯 Game Features

### Staking Rewards
- **10% APY**: Competitive reward rate
- **Real-time Calculation**: Accurate reward computation
- **Flexible Unstaking**: No lock periods
- **Compound Rewards**: Reinvest automatically

### NFT System
- **Unique Metadata**: Each NFT has unique attributes
- **Rarity System**: Common to Legendary rarities
- **Dynamic Attributes**: Power, element, generation
- **Metadata Storage**: On-chain metadata

## 🚨 Emergency Functions

### Owner Controls
- **Pause Staking**: Emergency pause
- **Fund Rewards**: Add reward funds
- **Emergency Withdraw**: Emergency fund recovery
- **Update Parameters**: Modify contract settings

## 📞 Support

For issues or questions:
- Check the test files for usage examples
- Review the contract code for implementation details
- Test on Hardhat/localhost before Fuji deployment
- Ensure Avalanche Fuji is selected in MetaMask

## 📄 License

MIT License - see LICENSE file for details.

---

**🎮 Ready to integrate real smart contracts into your Devil World game!** 🚀