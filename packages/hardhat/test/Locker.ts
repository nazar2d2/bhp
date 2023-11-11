import { TokenBHP, Locker } from "../typechain-types";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { parseUnits } from "ethers/lib/utils";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("TokenBHP", function () {
  async function deployFixture(): Promise<[TokenBHP, Locker]> {
    const [owner, multiSignAddress, royaltyAddress] = await ethers.getSigners();

    const TokenBHP = await ethers.getContractFactory("TokenBHP");
    const tokenBHP = (await TokenBHP.deploy(
      owner.address,
      "Name",
      "SMB",
      multiSignAddress.address,
      multiSignAddress.address,
      royaltyAddress.address,
    )) as TokenBHP;
    await tokenBHP.deployed();

    const Locker = await ethers.getContractFactory("Locker");
    const locker = (await Locker.deploy()) as Locker;
    await locker.deployed();

    return [tokenBHP, locker];
  }

  describe("Lock / Unlock", function () {
    const lockYears = 5;
    const amount = parseUnits("1000");
    let tokenBHP: TokenBHP;
    let locker: Locker;

    beforeEach(async function () {
      [tokenBHP, locker] = await loadFixture(deployFixture);
      await tokenBHP.approve(locker.address, amount.mul(2));
    });

    it("Should lock and show in balance", async function () {
      await locker.depositTokens(tokenBHP.address, amount, lockYears);
      const balance = await locker.getBalanceOf(tokenBHP.address);

      expect(balance).eq(amount);
    });

    it("Should increase lock balance", async function () {
      await locker.depositTokens(tokenBHP.address, amount, lockYears);

      await time.increase(3600 * 24);
      await locker.depositTokens(tokenBHP.address, amount, lockYears);
      const balance = await locker.getBalanceOf(tokenBHP.address);

      expect(balance).eq(amount.mul(2));
    });

    it("Should don't change lock time on second deposit", async function () {
      const [owner] = await ethers.getSigners();

      await locker.depositTokens(tokenBHP.address, amount, lockYears);
      const currentTime = await time.latest();
      await time.increase(3600 * 24);
      await locker.depositTokens(tokenBHP.address, amount, lockYears);

      const getUnlockTime = await locker.getUnlockTime(tokenBHP.address, owner.address);
      expect(getUnlockTime).eq(currentTime + 3600 * 24 * 365 * lockYears);
    });

    it("Should lock don't allow to unlock earlier", async function () {
      await locker.depositTokens(tokenBHP.address, amount, lockYears);

      // check in 365 days
      await time.increase(3600 * 24 * 365);
      await expect(locker.withdrawTokens(tokenBHP.address)).to.be.revertedWithCustomError(
        locker,
        "Locker_LockPeriodNotEnded",
      );
    });

    it(`Should not allow withdraw 2 times`, async function () {
      await locker.depositTokens(tokenBHP.address, amount, lockYears);

      await time.increase(3600 * 24 * 365 * lockYears);
      await locker.withdrawTokens(tokenBHP.address);

      await expect(locker.withdrawTokens(tokenBHP.address)).to.be.rejectedWith("Locker_NoDepositForToken");
    });

    it(`Should allow unlock in ${lockYears} years`, async function () {
      await locker.depositTokens(tokenBHP.address, amount, lockYears);

      await time.increase(3600 * 24 * 365 * lockYears);
      await locker.withdrawTokens(tokenBHP.address);

      const balance = await locker.getBalanceOf(tokenBHP.address);
      expect(balance).eq(0);
    });
  });
});
