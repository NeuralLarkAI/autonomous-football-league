import { ethers, network } from "hardhat";

async function main() {
  if (network.name === "base") {
    throw new Error("Refusing to deploy to Base mainnet. Use baseSepolia for testnet.");
  }

  const AFL_TOKEN = process.env.AFL_TOKEN_ADDRESS;
  const BUYBACK_WALLET = process.env.BUYBACK_WALLET;
  const TREASURY_WALLET = process.env.TREASURY_WALLET;

  if (!AFL_TOKEN || !BUYBACK_WALLET || !TREASURY_WALLET) {
    throw new Error("Set AFL_TOKEN_ADDRESS, BUYBACK_WALLET, TREASURY_WALLET env vars");
  }

  console.log("Deploying AFLVault...");
  const Vault = await ethers.getContractFactory("AFLVault");
  const vault = await Vault.deploy(AFL_TOKEN, BUYBACK_WALLET, TREASURY_WALLET);
  await vault.waitForDeployment();

  console.log("AFLVault deployed to:", vault.target);
  console.log("⚠️  Do NOT deploy to mainnet without owner review.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

