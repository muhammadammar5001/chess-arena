import hre from "hardhat";

async function main() {
  console.log("Deploying GameEscrow contract...");
  const GameEscrow = await hre.ethers.getContractFactory("GameEscrow");
  const escrow = await GameEscrow.deploy();
  await escrow.waitForDeployment();

  const address = await escrow.getAddress();
  console.log("GameEscrow deployed to:", address);

  // Grant SETTLEMENT_ROLE to the deployer by default so backend can sign
  const SETTLEMENT_ROLE = hre.ethers.id("SETTLEMENT_ROLE");
  console.log("Granting SETTLEMENT_ROLE to backend operator...");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
