import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { ethers } from "hardhat";
import { TokenBHP, Staking } from "../typechain-types";
import { formatEther } from "ethers/lib/utils";

const TEST_ADDRESS = "0x0000000000000000000000000000000000000001";

describe("Staking", function () {
  const totalStakingSupply = ethers.utils.parseEther("323600000");

  async function deployFixture(): Promise<[TokenBHP, Staking]> {
    const [owner] = await ethers.getSigners();

    const TokenBHP = await ethers.getContractFactory("TokenBHP");
    const tokenBHP = (await TokenBHP.deploy(
      owner.address,
      "Token",
      "TKN",
      TEST_ADDRESS,
      TEST_ADDRESS,
      TEST_ADDRESS,
    )) as TokenBHP;
    await tokenBHP.deployed();

    const Staking = await ethers.getContractFactory("Staking");
    const staking = (await Staking.deploy(owner.address, tokenBHP.address)) as Staking;
    await staking.deployed();

    await tokenBHP.setStakingContractAddress(staking.address);

    return [tokenBHP, staking];
  }

  describe("Deployment", function () {
    let tokenBHP: TokenBHP;
    let staking: Staking;

    beforeEach(async function () {
      [tokenBHP, staking] = await loadFixture(deployFixture);
    });

    it("Should have a token", async function () {
      expect(await staking.token()).to.eq(tokenBHP.address);
    });

    it("Should not be paused", async function () {
      expect(await staking.isPaused()).to.eq(false);
    });

    it("Check pause/unpause functionality", async function () {
      await staking.pause();
      expect(await staking.isPaused()).to.eq(true);

      await staking.unpause();
      expect(await staking.isPaused()).to.eq(false);
    });

    it("Pause don't allow to deposit", async function () {
      await staking.pause();

      const amount = ethers.utils.parseEther("1000");
      await tokenBHP.approve(staking.address, amount);
      expect(staking.deposit(amount)).to.be.revertedWithCustomError(staking, "Staking_IsPaused");
    });

    it("Should have 0 stake balance", async function () {
      expect(await staking.totalStaked()).to.eq(0);
    });

    it("Should have rewards per second", async function () {
      expect(await staking.rewardsPerSecond()).gt(0);
    });

    it("Should not generate rewards without minimal amount of tokens", async function () {
      expect(await staking.stakingStartTime()).to.eq(0);
    });

    it("Should have tokens in balance", async function () {
      expect(await tokenBHP.balanceOf(staking.address)).to.eq(totalStakingSupply);
    });
  });

  describe("Deposit", function () {
    let tokenBHP: TokenBHP;
    let staking: Staking;
    let signer: SignerWithAddress;
    let amount = ethers.utils.parseEther("21000000");

    beforeEach(async function () {
      [tokenBHP, staking] = await loadFixture(deployFixture);

      [signer] = await ethers.getSigners();
      await tokenBHP.approve(staking.address, amount.mul(2));
    });

    it("Should transfer amount", async function () {
      await expect(staking.deposit(amount)).to.changeTokenBalances(
        tokenBHP,
        [signer, staking],
        [amount.mul(-1), amount],
      );
    });

    it("Should have a correct totalStaked amount", async function () {
      await staking.deposit(amount);
      expect(await staking.totalStaked()).to.eq(amount);
    });

    it("Should have a balanceOf(address) equal to amount transferred", async function () {
      await staking.deposit(amount);
      const [stake, rewards] = await staking.getDepositInfo(signer.address);

      expect(stake).to.eq(amount);
      expect(rewards).to.eq(0);
    });

    it("Should have a correct user staking info on first stake", async function () {
      await staking.deposit(amount);
      const latest = await time.latest();
      const stakingInfo = await staking.userStakes(signer.address);

      expect(stakingInfo.timeOfLastUpdate).to.eq(latest);
      expect(stakingInfo.startStaking).to.eq(latest);
      expect(stakingInfo.unclaimedRewards).to.eq(0);
      expect(stakingInfo.deposited).to.eq(amount);
    });

    it("Should have a correct user staking info on second stake", async function () {
      // first deposit
      await staking.deposit(amount);
      const first = await time.latest();

      // second deposit
      await staking.deposit(amount);
      const latest = await time.latest();
      const stakingInfo = await staking.userStakes(signer.address);

      expect(stakingInfo.timeOfLastUpdate).to.eq(latest);
      expect(stakingInfo.startStaking).to.eq(first);
      expect(stakingInfo.unclaimedRewards).gt(0);
      expect(stakingInfo.deposited).to.eq(amount.mul(2));
    });

    describe("Validations", function () {
      it("Should revert if staking address not approved", async function () {
        const [, addr1] = await ethers.getSigners();
        amount = ethers.utils.parseEther("1000000");
        await expect(staking.connect(addr1).deposit(amount)).to.be.reverted;
      });

      it("Should revert if address has insufficient balance", async function () {
        const [, addr1] = await ethers.getSigners();
        await tokenBHP.connect(addr1).approve(staking.address, totalStakingSupply);
        await expect(staking.connect(addr1).deposit(totalStakingSupply)).to.be.reverted;
      });
    });

    describe("Events", function () {
      it("Should emit Deposit event", async function () {
        await expect(staking.deposit(amount)).to.emit(staking, "Deposit").withArgs(signer.address, amount);
      });
    });
  });

  describe("Rewards", function () {
    let tokenBHP: TokenBHP;
    let staking: Staking;
    let acc1: SignerWithAddress;
    let acc2: SignerWithAddress;
    let rewardPerSecond: BigNumber;
    const amount = ethers.utils.parseEther("21000000");

    beforeEach(async function () {
      [tokenBHP, staking] = await loadFixture(deployFixture);
      [, acc1, acc2] = await ethers.getSigners();

      // transfer tokens
      await tokenBHP.transfer(acc1.address, amount);
      await tokenBHP.transfer(acc2.address, amount);

      // approve tokens for staking
      await tokenBHP.connect(acc1).approve(staking.address, amount);
      await tokenBHP.connect(acc2).approve(staking.address, amount);

      rewardPerSecond = await staking.rewardsPerSecond();
    });

    it("Should not start producing rewards, no 21M tokens in totalStake", async function () {
      await staking.connect(acc1).deposit(amount.div(2));
      await staking.connect(acc2).deposit(amount.div(4));
      await time.increase(1);

      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      expect(acc1Rewards).to.eq(0);
    });

    it("Correct rewards in 1 second - 1 user (-10%)", async function () {
      await staking.connect(acc1).deposit(amount);
      await time.increase(1);

      const [acc1Stake, acc1Rewards] = await staking.getDepositInfo(acc1.address);

      expect(acc1Stake).to.eq(amount);
      expect(acc1Rewards).to.eq(rewardPerSecond.mul(90).div(100));
    });

    it("Correct rewards in 21 days - 1 user (-10%)", async function () {
      await staking.connect(acc1).deposit(amount);
      const seconds = 60 * 60 * 24 * 21;
      await time.increase(seconds);

      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      expect(acc1Rewards).to.eq(rewardPerSecond.mul(seconds).mul(90).div(100));
    });

    it("Correct rewards in 30 days - 1 user (1x)", async function () {
      await staking.connect(acc1).deposit(amount);
      const seconds = 60 * 60 * 24 * 30;
      await time.increase(seconds);

      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      expect(acc1Rewards).to.eq(rewardPerSecond.mul(seconds));
    });

    it("Correct rewards in 90 days - 1 user (no multiplier)", async function () {
      await staking.connect(acc1).deposit(amount);
      const seconds = 60 * 60 * 24 * 90;
      await time.increase(seconds);

      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      expect(acc1Rewards).to.eq(rewardPerSecond.mul(seconds));
    });

    it("Correct rewards in 180 days - 2 users, 150% diff", async function () {
      await staking.connect(acc1).deposit(amount);
      const seconds = 60 * 60 * 24 * 180;
      await time.increase(seconds);

      await staking.connect(acc2).deposit(amount);
      const [, acc1RewardsStartAfter] = await staking.getDepositInfo(acc1.address);
      await time.increase(seconds);

      const [, acc1RewardsEnd] = await staking.getDepositInfo(acc1.address);
      const [, acc2RewardsEnd] = await staking.getDepositInfo(acc2.address);

      // Acc 1 earned more in second epoch, because staking period is longer
      expect(acc1RewardsEnd.sub(acc1RewardsStartAfter)).gt(acc1RewardsStartAfter);
      expect(acc1RewardsStartAfter).gt(acc2RewardsEnd);
    });

    it("Correct rewards in 180 days - 2 users, with 2x multiplier", async function () {
      await staking.connect(acc1).deposit(amount.div(2));
      await staking.connect(acc2).deposit(amount.div(2));

      const seconds30d = 60 * 60 * 24 * 30;
      await time.increase(seconds30d);

      // Get current rewards and withdraw
      const [, acc1RewardsStart] = await staking.getDepositInfo(acc1.address);
      const [, acc2RewardsStart] = await staking.getDepositInfo(acc2.address);
      expect(acc1RewardsStart).to.eq(acc2RewardsStart);

      await staking.connect(acc2).withdraw(amount.div(2));

      // Get rewards after withdraw
      const [, acc1RewardsAfterWithdraw] = await staking.getDepositInfo(acc1.address);
      const [, acc2RewardsAfterWithdraw] = await staking.getDepositInfo(acc2.address);
      expect(acc2RewardsAfterWithdraw).gt(acc2RewardsStart);
      expect(acc1RewardsAfterWithdraw).to.equal(acc2RewardsAfterWithdraw.mul(2));

      await time.increase(seconds30d);

      // Check rewards after 30 days
      // const [, acc1RewardsEnd] = await staking.getDepositInfo(acc1.address);
      const [, acc2RewardsEnd] = await staking.getDepositInfo(acc2.address);

      expect(acc2RewardsEnd).to.eq(acc2RewardsAfterWithdraw);
    });

    it("Correct rewards in 1 second - 2 users (50/50)", async function () {
      await staking.connect(acc1).deposit(amount.div(2));
      await staking.connect(acc2).deposit(amount.div(2));
      await time.increase(1);

      // acc1 staking 1 sec without rewards
      // When acc2 add staking amount, we start calculating rewards
      // As result: both users have same rewards
      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      const [, acc2Rewards] = await staking.getDepositInfo(acc2.address);

      expect(acc1Rewards).to.eq(acc2Rewards);
    });

    it("Correct rewards in 1 and 2 seconds - 2 users (50/50)", async function () {
      await staking.connect(acc1).deposit(amount);
      await staking.connect(acc2).deposit(amount);
      await time.increase(1);

      // acc1 start staking and activate rewards
      // acc2 start staking 1 sec later
      // As result: acc1 have 2x rewards
      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      const [, acc2Rewards] = await staking.getDepositInfo(acc2.address);

      expect(acc1Rewards).to.eq(acc2Rewards.mul(2));
    });

    // Test for 2 users staking, different amounts
    it("Correct rewards in 1 second - 2 users (10/90)", async function () {
      await staking.connect(acc1).deposit(amount.div(10));
      await staking.connect(acc2).deposit(amount.div(10).mul(9));
      await time.increase(1);

      // acc1 staking 1 sec without rewards (10%)
      // When acc2 add staking amount (90%), we start calculating rewards
      // As result: acc1 have 9x rewards
      const [, acc1Rewards] = await staking.getDepositInfo(acc1.address);
      const [, acc2Rewards] = await staking.getDepositInfo(acc2.address);

      expect(acc1Rewards).to.eq(acc2Rewards.div(9));
    });

    // Test for 2 users staking, different amounts, different time
    it("Correct rewards in 1 and 2 seconds - 2 users (10/1)", async function () {
      await staking.connect(acc1).deposit(amount);
      await time.increase(10);
      const [, acc1StartRewards] = await staking.getDepositInfo(acc1.address);

      await staking.connect(acc2).deposit(amount.div(10));
      await time.increase(1);

      // acc1 start staking by deposit 100% and activate rewards
      // acc2 increase staking amount by 10%, 10 sec later
      // As result: acc1 have 10x rewards in new period + rewards for 10 sec in previous period
      const [, acc1FinalRewards] = await staking.getDepositInfo(acc1.address);
      const [, acc2FinalRewards] = await staking.getDepositInfo(acc2.address);

      const acc1Final = parseFloat(formatEther(acc1FinalRewards.sub(acc1StartRewards))).toFixed(16);
      const acc2Final = parseFloat(formatEther(acc2FinalRewards.mul(10))).toFixed(16);

      expect(acc1Final).to.eq(acc2Final);
    });

    it("Correct rewards in 2.5 years, when staking stopped", async function () {
      await staking.connect(acc1).deposit(amount);
      await time.increase(3600 * 24 * 900);
      await time.increase(1);

      const [, rewards] = await staking.getDepositInfo(acc1.address);

      expect(rewards).lte(totalStakingSupply);
    });

    it("Check big numbers", async function () {
      const [owner] = await ethers.getSigners();
      const amount = await tokenBHP.balanceOf(owner.address);
      const acc1InitBalance = await tokenBHP.balanceOf(acc1.address);

      await tokenBHP.transfer(acc1.address, amount);
      await tokenBHP.connect(acc1).approve(staking.address, amount);

      await staking.connect(acc1).deposit(amount);
      await time.increase(3600 * 24 * 10000);

      const [, rewards] = await staking.connect(acc1).getDepositInfo(acc1.address);
      await staking.connect(acc1).claimRewards();
      const acc1Balance = await tokenBHP.balanceOf(acc1.address);
      expect(acc1Balance).to.equal(acc1InitBalance.add(rewards));
    });
  });

  describe("Claim", function () {
    let tokenBHP: TokenBHP;
    let staking: Staking;
    let signer: SignerWithAddress;
    let rewardPerSecond: BigNumber;
    let reward: BigNumber;
    const amount = ethers.utils.parseEther("21000000");

    beforeEach(async function () {
      [tokenBHP, staking] = await loadFixture(deployFixture);
      [signer] = await ethers.getSigners();

      rewardPerSecond = await staking.rewardsPerSecond();
      await tokenBHP.approve(staking.address, amount);
      await staking.deposit(amount);

      const seconds = 60 * 60 * 24;
      await time.increase(seconds - 1);
      reward = rewardPerSecond.mul(seconds).mul(90).div(100);
    });

    it("should change token balances", async function () {
      await expect(staking.claimRewards()).to.changeTokenBalances(
        tokenBHP,
        [signer, staking],
        [reward, reward.mul(-1)],
      );
    });

    it("Should increment claimed", async function () {
      await staking.claimRewards();
      const [stake, rewards] = await staking.getDepositInfo(signer.address);

      expect(stake).to.eq(amount);
      expect(rewards).to.eq(0);
    });

    it("Should update timeOfLastUpdate when claimed", async function () {
      await staking.claimRewards();
      const last = await time.latest();
      const stakingInfo = await staking.userStakes(signer.address);

      expect(stakingInfo.timeOfLastUpdate).to.eq(last);
      expect(stakingInfo.deposited).to.eq(amount);
    });

    it("Should not change the total stake balance", async function () {
      const balance = await staking.totalStaked();
      await staking.claimRewards();
      expect(await staking.totalStaked()).to.eq(balance);
    });

    it("Should decrement the reward balance", async function () {
      const balance = await tokenBHP.balanceOf(staking.address);
      await staking.claimRewards();
      expect(await tokenBHP.balanceOf(staking.address)).to.eq(balance.sub(reward));
    });

    describe("Events", function () {
      it("Should emit Claim event", async function () {
        await expect(staking.claimRewards()).to.emit(staking, "ClaimRewards").withArgs(signer.address, reward);
      });
    });
  });

  describe("Withdraw", async function () {
    let tokenBHP: TokenBHP;
    let staking: Staking;
    let signer: SignerWithAddress;
    let rewardPerSecond: BigNumber;
    const amount = ethers.utils.parseEther("21000000");

    beforeEach(async function () {
      [tokenBHP, staking] = await loadFixture(deployFixture);
      [signer] = await ethers.getSigners();

      rewardPerSecond = await staking.rewardsPerSecond();
      await tokenBHP.approve(staking.address, amount);
      await staking.deposit(amount);

      const seconds = 60 * 60 * 24;
      await time.increase(seconds - 1);
    });

    it("Should change token balances", async function () {
      const amountWithdraw = amount.div(2);
      await expect(staking.withdraw(amountWithdraw)).to.changeTokenBalances(
        tokenBHP,
        [signer, staking],
        [amountWithdraw, amountWithdraw.mul(-1)],
      );
    });

    it("Should decrement user deposited balance", async function () {
      const stakingInfoBefore = await staking.userStakes(signer.address);
      const amountBefore = stakingInfoBefore.deposited;

      const withdrawAmount = amount.div(10);
      await staking.withdraw(withdrawAmount);

      const stakingInfoAfter = await staking.userStakes(signer.address);
      const amountAfter = stakingInfoAfter.deposited;

      expect(amountAfter).to.eq(amountBefore.sub(withdrawAmount));
    });

    it("Withdraw all - get deposit & rewards", async function () {
      const userBalanceBefore = await tokenBHP.balanceOf(signer.address);
      const [stake, rewards] = await staking.getDepositInfo(signer.address);

      await staking.withdrawAll();
      const userBalanceAfter = await tokenBHP.balanceOf(signer.address);

      expect(userBalanceAfter).gte(userBalanceBefore.add(rewards).add(stake));
      expect(userBalanceAfter).lt(userBalanceBefore.add(rewards).add(stake).add(rewardPerSecond));
    });

    it("Should decrement staking balance", async function () {
      const balance = await staking.totalStaked();

      await staking.withdraw(amount);
      expect(await staking.totalStaked()).to.eq(balance.sub(amount));
    });

    describe("Validations", function () {
      it("Should revert if amount gt balanceOf(address)", async function () {
        await expect(staking.withdraw(amount.add(1))).to.be.revertedWithCustomError(staking, "Staking_WithdrawAmount");
      });
    });

    describe("Events", function () {
      it("Should emit Withdraw event", async function () {
        await expect(staking.withdraw(amount)).to.emit(staking, "Withdraw").withArgs(signer.address, amount);
      });
    });

    describe("APY check", function () {
      it("Should show correct APY", async function () {
        await tokenBHP.approve(staking.address, amount);
        await staking.deposit(amount);
        await time.increase(1);

        const apy = await staking.getApy(signer.address);
        expect(apy).gt(0);
      });
    });
  });
});
