import "dotenv/config";
import "@nomicfoundation/hardhat-ethers";

const hardhatKey = process.env.PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    fuji: {
      type: "http",
      url: "https://api.avax-test.network/ext/bc/C/rpc",
      gasPrice: 25000000000, // 25 gwei
      chainId: 43113,
      ...(hardhatKey ? { accounts: [hardhatKey] } : {}),
    },
    localhost: {
      type: "http",
      url: "http://127.0.0.1:8545",
    },
  },
  etherscan: {
    apiKey: {
      avalancheFujiTestnet: process.env.SNOWTRACE_API_KEY || "",
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
