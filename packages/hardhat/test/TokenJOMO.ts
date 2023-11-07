import { ethers } from "hardhat";
import { TokenBHP, TokenJOMO } from "../typechain-types";
import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "ethers/lib/utils";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { beforeCommon, ContractsListParams } from "./_common";

describe("TokenJOMO", function () {
  let owner: SignerWithAddress;
  let acc1: SignerWithAddress;
  let acc3: SignerWithAddress;

  async function deployFixture(): Promise<[TokenBHP, TokenJOMO]> {
    [owner, acc1, , acc3] = await ethers.getSigners();
    const contracts: ContractsListParams = await beforeCommon();

    return [contracts.TokenBHP, contracts.TokenJOMO];
  }

  describe("Deployment", function () {
    let tokenJOMO: TokenJOMO;

    beforeEach(async function () {
      [, tokenJOMO] = await loadFixture(deployFixture);
    });

    it("Should have the name", async function () {
      expect(await tokenJOMO.name()).to.eq("Joy Of Missing Out");
    });

    it("Should have the symbol JOMO", async function () {
      expect(await tokenJOMO.symbol()).to.eq("JOMO");
    });

    it("Should not have supply", async function () {
      expect(await tokenJOMO.totalSupply()).to.eq(0);
    });

    it("Should have BLOCK_REWARD", async function () {
      expect(await tokenJOMO.BLOCK_REWARD()).gt(0);
    });
  });

  describe("Rewards", function () {
    let tokenBHP: TokenBHP;
    let tokenJOMO: TokenJOMO;
    let blockReward: BigNumber;
    const amountBHP = 5000;

    beforeEach(async function () {
      [tokenBHP, tokenJOMO] = await loadFixture(deployFixture);

      // Mint BHP on presale
      blockReward = await tokenJOMO.BLOCK_REWARD();
      const price = await tokenBHP.getPreSalePriceEth(amountBHP);
      await tokenBHP.connect(acc1).preSaleMintEth(amountBHP, { value: price });
    });

    it("Init balance, start from 0", async function () {
      const initBalance = await tokenJOMO.connect(acc1).balanceOf(acc1.address);
      expect(initBalance).to.eq(0);
    });

    it("Balance update in 100 blocks for 1 user", async function () {
      const blocksAmount = 100;
      await mine(blocksAmount - 1);
      await tokenBHP.connect(acc1).transfer(owner.address, parseEther("1"));
      const govBalance = await tokenJOMO.connect(acc1).balanceOf(acc1.address);

      const blockReward = await tokenJOMO.BLOCK_REWARD();
      expect(govBalance).to.eq(blockReward.mul(amountBHP).mul(blocksAmount));
    });

    it("Balance updates for 2 users", async function () {
      const blocksAmount = 1000;
      await mine(blocksAmount - 1);

      // TX: User 1 > User 2
      await tokenBHP.connect(acc1).transfer(acc3.address, parseEther("10"));
      const govBalanceUser1 = await tokenJOMO.connect(acc1).balanceOf(acc1.address);

      // TX: User 2 > User 1, +1 block
      await tokenBHP.connect(acc3).transfer(acc1.address, parseEther("10"));
      const govBalanceUser1Upd = await tokenJOMO.connect(acc1).balanceOf(acc1.address);
      const govBalanceUser2 = await tokenJOMO.connect(acc3).balanceOf(acc3.address);

      expect(govBalanceUser1Upd).to.eq(govBalanceUser1.add(blockReward.mul(4990)));
      expect(govBalanceUser2).to.eq(blockReward.mul(10).mul(1));
    });

    it("Error on transfer", async function () {
      expect(tokenJOMO.transfer(acc3.address, 1)).to.be.revertedWith("JOMO: Token is not transferable");
    });

    it("Error on call updateRewards from wrong user", async function () {
      expect(tokenJOMO.connect(acc3).mintRewards(acc3.address)).to.be.revertedWith(
        "JOMO: Only TokenBHP can update rewards",
      );
    });
  });
});
