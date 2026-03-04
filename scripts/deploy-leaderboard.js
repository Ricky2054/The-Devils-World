// Deploy DevilWorldLeaderboard to Avalanche Fuji testnet
import { ethers } from "ethers";
import { createRequire } from "module";
import * as dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);

const FUJI_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
  console.error("ERROR: PRIVATE_KEY not found in .env");
  process.exit(1);
}

async function main() {
  console.log("Deploying DevilWorldLeaderboard to Avalanche Fuji testnet...\n");

  const provider = new ethers.JsonRpcProvider(FUJI_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "AVAX\n");

  const artifact = require("../artifacts/contracts/DevilWorldLeaderboard.sol/DevilWorldLeaderboard.json");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const leaderboard = await factory.deploy();
  await leaderboard.waitForDeployment();

  const address = await leaderboard.getAddress();
  console.log("=== DEPLOYMENT COMPLETE ===");
  console.log("DevilWorldLeaderboard deployed to:", address);
  console.log("Snowtrace:", `https://testnet.snowtrace.io/address/${address}`);
  console.log("\nAdd to fujiNetwork.js:");
  console.log(`  LEADERBOARD: "${address}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Deployment failed:", error.message);
    process.exit(1);
  });
