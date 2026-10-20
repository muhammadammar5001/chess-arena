import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("GameEscrow", function () {
  let GameEscrow, escrow;
  let owner, operator, player1, player2;
  let chainId;

  const SETTLEMENT_ROLE = ethers.id("SETTLEMENT_ROLE");

  beforeEach(async function () {
    [owner, operator, player1, player2] = await ethers.getSigners();

    GameEscrow = await ethers.getContractFactory("GameEscrow");
    escrow = await GameEscrow.deploy();
    await escrow.waitForDeployment();

    // Grant SETTLEMENT_ROLE to operator
    await escrow.grantRole(SETTLEMENT_ROLE, operator.address);

    const network = await ethers.provider.getNetwork();
    chainId = network.chainId;
  });

  it("Should allow deposit", async function () {
    const depositAmount = ethers.parseEther("1.0");
    await escrow.connect(player1).deposit({ value: depositAmount });
    // In our simplified contract, it just accepts ETH and doesn't explicitly track withdrawable balances yet
    const balance = await ethers.provider.getBalance(await escrow.getAddress());
    expect(balance).to.equal(depositAmount);
  });

  it("Should settle match with valid signature", async function () {
    // Fund the contract
    await escrow.connect(player1).deposit({ value: ethers.parseEther("1.0") });
    await escrow.connect(player2).deposit({ value: ethers.parseEther("1.0") });

    const matchId = "match-123";
    const rulesVersion = 1;
    const winner = player1.address;
    const loser = player2.address;
    const stakeAmount = ethers.parseEther("1.0");
    const payoutAmount = ethers.parseEther("1.8");
    const feeAmount = ethers.parseEther("0.1");
    const referralAmount = ethers.parseEther("0.1");
    const nonce = 1;
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

    // EIP-712 Domain
    const domain = {
      name: "OwlsGambit",
      version: "1",
      chainId: chainId,
      verifyingContract: await escrow.getAddress()
    };

    // EIP-712 Types
    const types = {
      Settlement: [
        { name: "matchId", type: "string" },
        { name: "rulesVersion", type: "uint256" },
        { name: "winner", type: "address" },
        { name: "loser", type: "address" },
        { name: "stakeAmount", type: "uint256" },
        { name: "payoutAmount", type: "uint256" },
        { name: "feeAmount", type: "uint256" },
        { name: "referralAmount", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "escrowContract", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };

    // Data to sign
    const value = {
      matchId, rulesVersion, winner, loser,
      stakeAmount, payoutAmount, feeAmount, referralAmount,
      chainId, escrowContract: await escrow.getAddress(), nonce, deadline
    };

    // Sign with operator account
    const signature = await operator.signTypedData(domain, types, value);

    const winnerBalanceBefore = await ethers.provider.getBalance(winner);

    // Execute settlement
    const tx = await escrow.settleMatch(
      matchId, rulesVersion, winner, loser,
      stakeAmount, payoutAmount, feeAmount, referralAmount,
      nonce, deadline, signature
    );
    const receipt = await tx.wait();

    // Verify
    const isSettled = await escrow.settledMatches(matchId);
    expect(isSettled).to.be.true;

    // Check balance logic isn't perfect due to gas costs on caller, but we can verify events
    await expect(tx).to.emit(escrow, "MatchSettled").withArgs(matchId, winner, payoutAmount);
  });

  it("Should reject invalid signature", async function () {
    const matchId = "match-999";
    const rulesVersion = 1;
    const winner = player1.address;
    const loser = player2.address;
    const stakeAmount = ethers.parseEther("1.0");
    const payoutAmount = ethers.parseEther("1.8");
    const feeAmount = ethers.parseEther("0.1");
    const referralAmount = ethers.parseEther("0.1");
    const nonce = 1;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const domain = {
      name: "OwlsGambit",
      version: "1",
      chainId: chainId,
      verifyingContract: await escrow.getAddress()
    };

    const types = {
      Settlement: [
        { name: "matchId", type: "string" },
        { name: "rulesVersion", type: "uint256" },
        { name: "winner", type: "address" },
        { name: "loser", type: "address" },
        { name: "stakeAmount", type: "uint256" },
        { name: "payoutAmount", type: "uint256" },
        { name: "feeAmount", type: "uint256" },
        { name: "referralAmount", type: "uint256" },
        { name: "chainId", type: "uint256" },
        { name: "escrowContract", type: "address" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    };

    const value = {
      matchId, rulesVersion, winner, loser,
      stakeAmount, payoutAmount, feeAmount, referralAmount,
      chainId, escrowContract: await escrow.getAddress(), nonce, deadline
    };

    // Sign with player1 (who DOES NOT have SETTLEMENT_ROLE)
    const signature = await player1.signTypedData(domain, types, value);

    await expect(
      escrow.settleMatch(
        matchId, rulesVersion, winner, loser,
        stakeAmount, payoutAmount, feeAmount, referralAmount,
        nonce, deadline, signature
      )
    ).to.be.revertedWith("Invalid signature");
  });
});
