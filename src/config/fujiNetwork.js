// Avalanche Fuji Testnet Configuration
export const FUJI_NETWORK_CONFIG = {
  name: "Avalanche Fuji Testnet",
  rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
  chainId: 43113,
  currencySymbol: "AVAX",
  blockExplorer: "https://testnet.snowtrace.io",
  gasPrice: 25000000000,
};

// Contract addresses for Fuji testnet (override with REACT_APP_* env vars when needed)
export const FUJI_CONTRACT_ADDRESSES = {
  STAKING: process.env.REACT_APP_STAKING_ADDRESS || "0xC08f6E905C88Ae1252a78f3D6eCAb7CF7d27ac9f",
  NFT: process.env.REACT_APP_NFT_ADDRESS || "0xBd852B73011eb7937993b06F43891dD67C31BC10",
  TOKEN: process.env.REACT_APP_TOKEN_ADDRESS || "0xCd5b54dBEa2bF1aE449361F5c35af1E4fbA8aCcC",
  LEADERBOARD: process.env.REACT_APP_LEADERBOARD_ADDRESS || "0x0b8c3C6F2a30c0C4B9Cbb9C03A2F1D14B2eC2155",
};

// Network detection helper
export function isFujiNetwork(chainId) {
  return chainId === FUJI_NETWORK_CONFIG.chainId;
}

// Get current network configuration
export function getCurrentNetworkConfig(chainId) {
  if (isFujiNetwork(chainId)) {
    return FUJI_NETWORK_CONFIG;
  }
  return null;
}
