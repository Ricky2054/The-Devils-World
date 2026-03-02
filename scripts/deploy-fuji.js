// Deploy using ethers directly — avoids hre.ethers plugin issues with Hardhat 3
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

async function deployContract(wallet, artifactPath, constructorArgs = []) {
  const artifact = require(artifactPath);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(...constructorArgs);
  await contract.waitForDeployment();
  return contract;
}

async function main() {
  console.log("Deploying contracts to Avalanche Fuji testnet...");

  const provider = new ethers.JsonRpcProvider(FUJI_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deploying with account:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Account balance:", ethers.formatEther(balance), "AVAX");

  if (balance === 0n) {
    console.warn("WARNING: Account has 0 AVAX. Get testnet AVAX from https://faucet.avax.network");
  }

  // TREASURY: defaults to deployer — replace with your dedicated dev wallet if needed
  const TREASURY = wallet.address;

  // Deploy AVAX Staking
  console.log("\nDeploying AVAXStaking...");
  const avaxStaking = await deployContract(
    wallet,
    "../artifacts/contracts/AVAXStaking.sol/AVAXStaking.json",
    [TREASURY]
  );
  const stakingAddr = await avaxStaking.getAddress();
  console.log("AVAXStaking deployed to:", stakingAddr);

  // Deploy CryptoIslandNFT
  console.log("\nDeploying CryptoIslandNFT...");
  const cryptoIslandNFT = await deployContract(
    wallet,
    "../artifacts/contracts/CryptoIslandNFT.sol/CryptoIslandNFT.json",
    [TREASURY]
  );
  const nftAddr = await cryptoIslandNFT.getAddress();
  console.log("CryptoIslandNFT deployed to:", nftAddr);

  // Deploy CryptoIslandToken
  console.log("\nDeploying CryptoIslandToken...");
  const cryptoIslandToken = await deployContract(
    wallet,
    "../artifacts/contracts/CryptoIslandToken.sol/CryptoIslandToken.json",
    [TREASURY]
  );
  const tokenAddr = await cryptoIslandToken.getAddress();
  console.log("CryptoIslandToken deployed to:", tokenAddr);

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("STAKING :", stakingAddr);
  console.log("NFT     :", nftAddr);
  console.log("TOKEN   :", tokenAddr);

  console.log("\n=== UPDATE src/contracts/contracts.js with these addresses ===");
  console.log(`STAKING_ADDRESS: "${stakingAddr}"`);
  console.log(`NFT_ADDRESS:     "${nftAddr}"`);
  console.log(`TOKEN_ADDRESS:   "${tokenAddr}"`);

  console.log("\n=== SNOWTRACE LINKS ===");
  console.log("AVAXStaking:      https://testnet.snowtrace.io/address/" + stakingAddr);
  console.log("CryptoIslandNFT:  https://testnet.snowtrace.io/address/" + nftAddr);
  console.log("CryptoIslandToken:https://testnet.snowtrace.io/address/" + tokenAddr);
}

main()
  .then(() => {
    console.log("\nDone.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Deployment failed:", err.message);
    process.exit(1);
  });
