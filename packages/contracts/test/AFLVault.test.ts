import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AFLVault", function () {
  async function deploy() {
    const [owner, user, user2, buyback, treasury, winner, user3] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockAFLToken");
    const token = await Token.deploy();
    const Vault = await ethers.getContractFactory("AFLVault");
    const vault = await Vault.deploy(token.target, buyback.address, treasury.address);

    await token.mint(user.address, ethers.parseEther("10000"));
    await token.mint(user2.address, ethers.parseEther("10000"));
    await token.mint(user3.address, ethers.parseEther("10000"));

    await token.connect(user).approve(vault.target, ethers.MaxUint256);
    await token.connect(user2).approve(vault.target, ethers.MaxUint256);
    await token.connect(user3).approve(vault.target, ethers.MaxUint256);
    await token.connect(owner).approve(vault.target, ethers.MaxUint256);

    return { vault, token, owner, user, user2, user3, buyback, treasury, winner };
  }

  it("takes 2.5% fee on deposit and splits correctly", async () => {
    const { vault, token, user, buyback, treasury } = await deploy();
    const depositAmt = ethers.parseEther("1000");
    const expectedFee = (depositAmt * 250n) / 10000n; // 25 AFL
    const expectedStaked = depositAmt - expectedFee; // 975 AFL

    const buybackBefore = await token.balanceOf(buyback.address);
    const treasuryBefore = await token.balanceOf(treasury.address);

    await vault.connect(user).deposit(depositAmt, 0);

    const stake = await vault.getStake(user.address);
    expect(stake.amount).to.equal(expectedStaked);

    const buybackGained = (await token.balanceOf(buyback.address)) - buybackBefore;
    const treasuryGained = (await token.balanceOf(treasury.address)) - treasuryBefore;

    expect(buybackGained).to.equal((expectedFee * 50n) / 100n);
    expect(treasuryGained).to.equal((expectedFee * 25n) / 100n);

    const stats = await vault.vaultStats();
    expect(stats._prizePool).to.equal((expectedFee * 25n) / 100n);
  });

  it("prevents a second deposit while staked", async () => {
    const { vault, user } = await deploy();
    await vault.connect(user).deposit(ethers.parseEther("1000"), 0);
    await expect(vault.connect(user).deposit(ethers.parseEther("1"), 0)).to.be.revertedWith(
      "Already staking: withdraw first"
    );
  });

  it("prevents withdrawal before lock end", async () => {
    const { vault, user } = await deploy();
    await vault.connect(user).deposit(ethers.parseEther("1000"), 0);
    await expect(vault.connect(user).withdraw()).to.be.revertedWith("Still locked");
  });

  it("allows withdrawal after lock period", async () => {
    const { vault, token, user } = await deploy();
    const depositAmt = ethers.parseEther("1000");
    await vault.connect(user).deposit(depositAmt, 0);
    await time.increase(30 * 24 * 60 * 60 + 1);
    const balBefore = await token.balanceOf(user.address);
    await vault.connect(user).withdraw();
    const balAfter = await token.balanceOf(user.address);
    expect(balAfter).to.be.greaterThan(balBefore);
  });

  it("takes 2.5% fee on withdrawal too", async () => {
    const { vault, user } = await deploy();
    await vault.connect(user).deposit(ethers.parseEther("1000"), 0);
    await time.increase(30 * 24 * 60 * 60 + 1);
    const prizePoolBefore = (await vault.vaultStats())._prizePool;
    await vault.connect(user).withdraw();
    const prizePoolAfter = (await vault.vaultStats())._prizePool;
    expect(prizePoolAfter).to.be.greaterThan(prizePoolBefore);
  });

  it("only owner can distribute prize", async () => {
    const { vault, user, winner } = await deploy();
    await expect(vault.connect(user).distributePrize(winner.address)).to.be.revertedWithCustomError(
      vault,
      "OwnableUnauthorizedAccount"
    );
  });

  it("owner can distribute prize pool to winner", async () => {
    const { vault, token, owner, user, winner } = await deploy();
    await vault.connect(user).deposit(ethers.parseEther("1000"), 0);
    const prizePool = (await vault.vaultStats())._prizePool;
    expect(prizePool).to.be.greaterThan(0n);
    const winnerBefore = await token.balanceOf(winner.address);
    await vault.connect(owner).distributePrize(winner.address);
    const winnerAfter = await token.balanceOf(winner.address);
    expect(winnerAfter - winnerBefore).to.equal(prizePool);
    expect((await vault.vaultStats())._prizePool).to.equal(0n);
  });

  it("higher lock period gives higher multiplier rewards", async () => {
    const { vault, token, owner, user, user3 } = await deploy();

    await vault.connect(user).deposit(ethers.parseEther("1000"), 0); // 1.0x
    await vault.connect(user3).deposit(ethers.parseEther("1000"), 2); // 1.5x

    await token.mint(owner.address, ethers.parseEther("1000"));
    await vault.connect(owner).fundRewards(ethers.parseEther("100"));

    const earned30 = await vault.earned(user.address);
    const earned180 = await vault.earned(user3.address);
    expect(earned180).to.be.greaterThan(earned30);
  });

  it("claimRewards transfers earned rewards", async () => {
    const { vault, token, owner, user, user2 } = await deploy();
    await vault.connect(user).deposit(ethers.parseEther("1000"), 0);
    await vault.connect(user2).deposit(ethers.parseEther("1000"), 0);

    await token.mint(owner.address, ethers.parseEther("1000"));
    await vault.connect(owner).fundRewards(ethers.parseEther("10"));

    const earned = await vault.earned(user.address);
    expect(earned).to.be.greaterThan(0n);

    const balBefore = await token.balanceOf(user.address);
    await expect(vault.connect(user).claimRewards()).to.emit(vault, "RewardClaimed");
    const balAfter = await token.balanceOf(user.address);
    expect(balAfter - balBefore).to.equal(earned);
  });
});

