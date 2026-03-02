import { ethers } from 'ethers';
import { STAKING_ABI, NFT_ABI } from '../contracts/contracts.js';
import { TOKEN_ABI } from '../contracts/tokenABI.js';
import { FUJI_NETWORK_CONFIG, FUJI_CONTRACT_ADDRESSES, isFujiNetwork } from '../config/fujiNetwork.js';

class ContractService {
  constructor() {
    this.provider = null;
    this.ethereumProvider = null;
    this.signer = null;
    this.stakingContract = null;
    this.nftContract = null;
    this.tokenContract = null;
  }

  // Initialize provider and signer
  async initialize(providerOverride = null) {
    const selectedProvider = providerOverride || window.ethereum;

    if (typeof selectedProvider !== 'undefined' && selectedProvider) {
      this.ethereumProvider = selectedProvider;
      this.provider = new ethers.BrowserProvider(selectedProvider);
      this.signer = await this.provider.getSigner();
      
      // Get current network
      const network = await this.provider.getNetwork();
      const isFuji = isFujiNetwork(Number(network.chainId));
      if (!isFuji) {
        throw new Error(`Wrong network detected. Please switch to ${FUJI_NETWORK_CONFIG.name} (chainId ${FUJI_NETWORK_CONFIG.chainId}).`);
      }
      
      console.log('Current network:', network);
      console.log('Is Fuji network:', isFuji);
      
      // Use appropriate contract addresses based on network
      const contractAddresses = FUJI_CONTRACT_ADDRESSES;
      
      console.log('Using contract addresses:', contractAddresses);
      
      // Initialize contracts
      this.stakingContract = new ethers.Contract(
        contractAddresses.STAKING,
        STAKING_ABI,
        this.signer
      );
      
      this.nftContract = new ethers.Contract(
        contractAddresses.NFT,
        NFT_ABI,
        this.signer
      );
      
      this.tokenContract = new ethers.Contract(
        contractAddresses.TOKEN,
        TOKEN_ABI,
        this.signer
      );
      
      console.log('Contracts initialized:', {
        staking: this.stakingContract.address,
        nft: this.nftContract.address,
        token: this.tokenContract.address
      });
      
      return true;
    }
    return false;
  }

  // Get account balance
  async getAccountBalance(address) {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Error getting balance:', error);
      return '0.0';
    }
  }

  // Staking functions
  async stakeAVAX(amount) {
    try {
      const stakeAmount = ethers.parseEther(amount.toString());
      const tx = await this.stakingContract.stake({ value: stakeAmount });
      return tx;
    } catch (error) {
      console.error('Staking error:', error);
      throw error;
    }
  }

  async unstakeAVAX() {
    try {
      const tx = await this.stakingContract.unstake();
      return tx;
    } catch (error) {
      console.error('Unstaking error:', error);
      throw error;
    }
  }

  async claimRewards() {
    try {
      const tx = await this.stakingContract.claimRewards();
      return tx;
    } catch (error) {
      console.error('Claim rewards error:', error);
      throw error;
    }
  }

  async getStakerInfo(address) {
    try {
      const stakerInfo = await this.stakingContract.getStakerInfo(address);
      return {
        stakedAmount:     ethers.formatEther(stakerInfo.stakedAmount),
        stakingTimestamp: Number(stakerInfo.stakingTimestamp),
        pendingRewards:   ethers.formatEther(stakerInfo.pendingRewards),
        isStaking:        stakerInfo.isStaking,
        tier:             stakerInfo.tier,
        multiplierBps:    Number(stakerInfo.multiplierBps_),
        currentAPY:       Number(stakerInfo.currentAPY)
      };
    } catch (error) {
      console.error('Get staker info error:', error);
      return null;
    }
  }

  async calculateRewards(address) {
    try {
      const rewards = await this.stakingContract.calculateRewards(address);
      return ethers.formatEther(rewards);
    } catch (error) {
      console.error('Calculate rewards error:', error);
      return '0.0';
    }
  }

  async getContractStats() {
    try {
      const stats = await this.stakingContract.getContractStats();
      return {
        totalStaked:             ethers.formatEther(stats._totalStaked),
        totalRewardsPaid:        ethers.formatEther(stats._totalRewardsPaid),
        totalTreasuryCollected:  ethers.formatEther(stats._totalTreasuryCollected),
        contractBalance:         ethers.formatEther(stats.contractBalance)
      };
    } catch (error) {
      console.error('Get contract stats error:', error);
      return null;
    }
  }

  // ── NEW: AVAX staking tier & score helpers ────────────────────────────────

  /**
   * @returns {Promise<string>} "Bronze" | "Silver" | "Gold" | "None"
   */
  async getStakerTier(address) {
    try {
      return await this.stakingContract.getStakerTier(address);
    } catch (error) {
      console.error('Get staker tier error:', error);
      return 'None';
    }
  }

  /**
   * @returns {Promise<{net: string, fee: string}>} net reward & treasury fee in AVAX
   */
  async getStakerNetRewards(address) {
    try {
      const result = await this.stakingContract.calculateNetRewards(address);
      return {
        net: ethers.formatEther(result.net),
        fee: ethers.formatEther(result.fee)
      };
    } catch (error) {
      console.error('Get net rewards error:', error);
      return { net: '0.0', fee: '0.0' };
    }
  }

  /**
   * @returns {Promise<number>} multiplierBps e.g. 10000 = 1×, 20000 = 2×
   */
  async getScoreMultiplier(address) {
    try {
      const bps = await this.stakingContract.scoreMultiplierBps(address);
      return Number(bps) || 10000;
    } catch (error) {
      console.error('Get score multiplier error:', error);
      return 10000;
    }
  }

  // NFT functions
  async mintNFT() {
    try {
      const mintPrice = await this.nftContract.getMintPrice();
      const tx = await this.nftContract.mintNFT({ value: mintPrice });
      return tx;
    } catch (error) {
      console.error('Mint NFT error:', error);
      throw error;
    }
  }

  async getNFTBalance(address) {
    try {
      const balance = await this.nftContract.balanceOf(address);
      return Number(balance);
    } catch (error) {
      console.error('Get NFT balance error:', error);
      return 0;
    }
  }

  async getTotalSupply() {
    try {
      const totalSupply = await this.nftContract.totalSupply();
      return Number(totalSupply);
    } catch (error) {
      console.error('Get total supply error:', error);
      return 0;
    }
  }

  async getNFTMetadata(tokenId) {
    try {
      const metadata = await this.nftContract.getNFTMetadata(tokenId);
      return {
        name: metadata.name,
        description: metadata.description,
        image: metadata.image,
        attributes: metadata.attributes
      };
    } catch (error) {
      console.error('Get NFT metadata error:', error);
      return null;
    }
  }

  async getTokenURI(tokenId) {
    try {
      const tokenURI = await this.nftContract.tokenURI(tokenId);
      return tokenURI;
    } catch (error) {
      console.error('Get token URI error:', error);
      return null;
    }
  }

  async getOwnerOf(tokenId) {
    try {
      const owner = await this.nftContract.ownerOf(tokenId);
      return owner;
    } catch (error) {
      console.error('Get owner of token error:', error);
      return null;
    }
  }

  // Utility functions
  async getCurrentAddress() {
    try {
      return await this.signer.getAddress();
    } catch (error) {
      console.error('Get current address error:', error);
      return null;
    }
  }

  async getNetwork() {
    try {
      const network = await this.provider.getNetwork();
      return network;
    } catch (error) {
      console.error('Get network error:', error);
      return null;
    }
  }

  // ERC-20 Token functions
  async getTokenBalance(address) {
    try {
      const balance = await this.tokenContract.balanceOf(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Get token balance error:', error);
      return '0.0';
    }
  }

  async mintTokensWithAVAX(amount) {
    try {
      const tx = await this.tokenContract.mintWithAVAX(amount, {
        value: ethers.parseEther((amount * 0.001).toString())
      });
      return tx;
    } catch (error) {
      console.error('Mint tokens with AVAX error:', error);
      throw error;
    }
  }

  async stakeTokens(amount) {
    try {
      const stakeAmount = ethers.parseEther(amount.toString());
      const tx = await this.tokenContract.stakeTokens(stakeAmount);
      return tx;
    } catch (error) {
      console.error('Stake tokens error:', error);
      throw error;
    }
  }

  async unstakeTokens() {
    try {
      const tx = await this.tokenContract.unstakeTokens();
      return tx;
    } catch (error) {
      console.error('Unstake tokens error:', error);
      throw error;
    }
  }

  async claimTokenRewards() {
    try {
      const tx = await this.tokenContract.claimRewards();
      return tx;
    } catch (error) {
      console.error('Claim token rewards error:', error);
      throw error;
    }
  }

  async getTokenStakerInfo(address) {
    try {
      // Use the new getStakerInfo function on the CIT contract (added in enhanced version)
      const stakerInfo = await this.tokenContract.getStakerInfo(address);
      return {
        stakedAmount:     ethers.formatEther(stakerInfo.stakedAmount),
        stakingTimestamp: Number(stakerInfo.stakingTimestamp),
        pendingRewards:   ethers.formatEther(stakerInfo.pendingRewards),
        isStaking:        stakerInfo.isStaking,
        tier:             stakerInfo.tier,
        multiplierBps:    Number(stakerInfo.multiplierBps_),
        currentAPY:       Number(stakerInfo.currentAPY)
      };
    } catch (error) {
      // Fallback to raw stakers mapping for backwards compatibility
      try {
        const s = await this.tokenContract.stakers(address);
        const pendingRewards = await this.tokenContract.calculateRewards(address);
        return {
          stakedAmount:     ethers.formatEther(s.stakedAmount),
          stakingTimestamp: Number(s.stakingTimestamp),
          pendingRewards:   ethers.formatEther(pendingRewards),
          isStaking:        s.isStaking,
          tier:             'Bronze',
          multiplierBps:    10000,
          currentAPY:       10
        };
      } catch (e) {
        console.error('Get token staker info error:', e);
        return null;
      }
    }
  }

  // ── NEW: CIT staking tier & score helpers ─────────────────────────────────

  /**
   * @returns {Promise<string>} "Bronze" | "Silver" | "Gold" | "None"
   */
  async getTokenStakerTier(address) {
    try {
      return await this.tokenContract.getStakerTier(address);
    } catch (error) {
      console.error('Get token staker tier error:', error);
      return 'None';
    }
  }

  /**
   * @returns {Promise<{net: string, fee: string}>} net CIT reward & treasury fee
   */
  async getTokenNetRewards(address) {
    try {
      const result = await this.tokenContract.calculateNetRewards(address);
      return {
        net: ethers.formatEther(result.net),
        fee: ethers.formatEther(result.fee)
      };
    } catch (error) {
      console.error('Get token net rewards error:', error);
      return { net: '0.0', fee: '0.0' };
    }
  }

  async calculateTokenRewards(address) {
    try {
      const rewards = await this.tokenContract.calculateRewards(address);
      return ethers.formatEther(rewards);
    } catch (error) {
      console.error('Calculate token rewards error:', error);
      return '0.0';
    }
  }

  async getTokenInfo() {
    try {
      // Read individual ERC-20 fields (getTokenInfo view doesn't exist on-chain)
      const [name, symbol, totalSupply] = await Promise.all([
        this.tokenContract.name(),
        this.tokenContract.symbol(),
        this.tokenContract.totalSupply()
      ]);
      return {
        name,
        symbol,
        decimals: 18,
        totalSupply: ethers.formatEther(totalSupply),
        maxSupply: '10000000', // MAX_SUPPLY constant
        mintPrice: '0.001'     // MINT_PRICE constant
      };
    } catch (error) {
      console.error('Get token info error:', error);
      return { name: 'Crypto Island Token', symbol: 'CIT', decimals: 18, totalSupply: '0', maxSupply: '10000000', mintPrice: '0.001' };
    }
  }

  async getTokenContractStats() {
    try {
      // Read available on-chain fields (getContractStats doesn't exist on CIT)
      const [totalSupply, totalStaked] = await Promise.all([
        this.tokenContract.totalSupply(),
        this.tokenContract.totalStaked()
      ]);
      const contractBalance = await this.provider.getBalance(await this.tokenContract.getAddress());
      return {
        totalStaked: ethers.formatEther(totalStaked),
        totalRewardsPaid: '0',
        contractBalance: ethers.formatEther(contractBalance),
        totalSupply: ethers.formatEther(totalSupply)
      };
    } catch (error) {
      console.error('Get token contract stats error:', error);
      return { totalStaked: '0', totalRewardsPaid: '0', contractBalance: '0', totalSupply: '0' };
    }
  }

  async transferTokens(to, amount) {
    try {
      const transferAmount = ethers.parseEther(amount.toString());
      const tx = await this.tokenContract.transfer(to, transferAmount);
      return tx;
    } catch (error) {
      console.error('Transfer tokens error:', error);
      throw error;
    }
  }

  async approveTokens(spender, amount) {
    try {
      const approveAmount = ethers.parseEther(amount.toString());
      const tx = await this.tokenContract.approve(spender, approveAmount);
      return tx;
    } catch (error) {
      console.error('Approve tokens error:', error);
      throw error;
    }
  }

  // Check if contracts are initialized
  isInitialized() {
    return this.provider && this.signer && this.stakingContract && this.nftContract && this.tokenContract;
  }
}

// Export singleton instance
export const contractService = new ContractService();
export default ContractService;
