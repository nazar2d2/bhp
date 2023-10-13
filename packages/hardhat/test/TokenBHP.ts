import { ethers } from "hardhat";
import { TokenBHP, TokenPresale } from "../typechain-types";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { formatEther, parseUnits, formatUnits } from "ethers/lib/utils";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("TokenBHP", function () {
  const name = "Token";
  const symbol = "TKN";
  const totalSupply = ethers.utils.parseEther((1618 * 10 ** 6).toString());
  const daysUnlock = 720;
  let owner: SignerWithAddress;
  let acc1: SignerWithAddress;
  let multiSignAddress: SignerWithAddress;

  async function deployFixture(): Promise<[TokenBHP, TokenPresale]> {
    [owner, acc1, multiSignAddress] = await ethers.getSigners();

    const TokenPresale = await ethers.getContractFactory("TokenPresale");
    const tokenPresale = (await TokenPresale.deploy(owner.address, acc1.address)) as TokenPresale;
    await tokenPresale.deployed();

    const TokenBHP = await ethers.getContractFactory("TokenBHP");
    const tokenBHP = (await TokenBHP.deploy(
      owner.address,
      name,
      symbol,
      multiSignAddress.address,
      tokenPresale.address,
    )) as TokenBHP;
    await tokenBHP.deployed();

    return [tokenBHP, tokenPresale];
  }

  describe("Deployment", function () {
    let tokenBHP: TokenBHP;

    beforeEach(async function () {
      [tokenBHP,] = await loadFixture(deployFixture)
    });

    it("Should have the name Token", async function () {
      expect(await tokenBHP.name()).to.eq(name);
    });

    it("Should have the symbol TKN", async function () {
      expect(await tokenBHP.symbol()).to.eq(symbol);
    });

    it("Should have 28% of total supply (20% LP + 4% Marketing + 4% Ecosystem)", async function () {
      const expectedAmountLP = totalSupply.div(5);
      const unlockedForMarketing = totalSupply.div(5).div(5);
      const unlockedForEcosystem = totalSupply.div(5).div(5);

      expect(await tokenBHP.totalSupply()).to.eq(expectedAmountLP.add(unlockedForMarketing).add(unlockedForEcosystem));
    });
  });

  describe("Ecosystem Rewards / Marketing", function () {
    let tokenBHP: TokenBHP;
    let totalSupply: BigNumber;
    let vestingSupply: BigNumber;

    beforeEach(async function () {
      [tokenBHP,] = await loadFixture(deployFixture);
      totalSupply = await tokenBHP.MAX_SUPPLY();

      const distributionSupply = totalSupply.div(5);
      vestingSupply = distributionSupply.sub(distributionSupply.div(5));
    });

    it("Check ecosystem/marketing rewards - 1 month", async function () {
      // Check rewards after 1 month
      await time.increase(3600 * 24 * 31);
      const rewards = await tokenBHP.getEcosystemMarketingUnlocked();
      const rewardTokens = parseInt(formatEther(rewards));

      const expectedRewards = vestingSupply.div(daysUnlock).mul(31);
      const expectedTokens = parseInt(formatEther(expectedRewards));

      expect(rewardTokens).gte(expectedTokens);
      expect(rewardTokens).lt(expectedTokens + expectedTokens * 0.00001);
    });

    it("Check ecosystem/marketing rewards - 1 year", async function () {
      // Check rewards after 1 year
      await time.increase(3600 * 24 * 180);
      const rewards = await tokenBHP.getEcosystemMarketingUnlocked();
      const rewardTokens = parseFloat(formatEther(rewards));

      const expectedRewards = vestingSupply.div(daysUnlock).mul(180);
      const expectedTokens = parseFloat(formatEther(expectedRewards));

      expect(rewardTokens).gte(expectedTokens);
      expect(rewardTokens).lt(expectedTokens + expectedTokens * 0.00001);
    });

    it("Mint ecosystem rewards in 6 month", async function () {
      await time.increase(3600 * 24 * 180);
      const rewards = await tokenBHP.getEcosystemMarketingUnlocked();
      const expectedRewards = vestingSupply.div(daysUnlock).mul(180);

      const balanceInit = await tokenBHP.balanceOf(multiSignAddress.address);
      await tokenBHP.ecosystemMint();
      const balanceUpd = await tokenBHP.balanceOf(multiSignAddress.address);

      expect(rewards).gte(expectedRewards);
      expect(rewards).lt(expectedRewards.add(expectedRewards.div(100000)));

      expect(balanceInit.add(rewards)).to.equal(balanceUpd);
    });

    it("Mint ecosystem rewards - second mint in 10 days, no tokens", async function () {
      await time.increase(3600 * 24 * 180);

      // Mint first time
      await tokenBHP.ecosystemMint();
      const balanceInit = await tokenBHP.balanceOf(multiSignAddress.address);

      // Mint in 90 days
      await time.increase(3600 * 24 * 90);
      await tokenBHP.ecosystemMint();
      const balanceUpd = await tokenBHP.balanceOf(multiSignAddress.address);

      // No new tokens after mint
      expect(balanceInit).to.equal(balanceUpd);
    });

    it("Marketing check rewards", async function () {
      // Check rewards after 6 month
      await time.increase(3600 * 24 * 180);
      const rewards = await tokenBHP.getEcosystemMarketingUnlocked();
      const expectedRewards = vestingSupply.div(daysUnlock).mul(180);
      expect(rewards).gte(expectedRewards);
      expect(rewards).lt(expectedRewards.add(expectedRewards.div(100000)));

      const unlocked = await tokenBHP.getMarketingUnlocked();
      expect(unlocked).gt(0);
      expect(unlocked).to.equal(rewards);
    });

    it("Mint marketing tokens", async function () {
      // Check rewards after 6 month
      await time.increase(3600 * 24 * 180);
      const rewards = await tokenBHP.getEcosystemMarketingUnlocked();

      const balanceInit = await tokenBHP.balanceOf(multiSignAddress.address);
      await tokenBHP.marketingMint();
      const balanceUpd = await tokenBHP.balanceOf(multiSignAddress.address);

      expect(balanceInit.add(rewards)).to.equal(balanceUpd);
    });
  });

  describe("PreSale", function () {
    let tokenBHP: TokenBHP;
    let tokenPresale: TokenPresale;
    let totalSupply: BigNumber;

    beforeEach(async function () {
      [tokenBHP, tokenPresale] = await loadFixture(deployFixture);
      totalSupply = await tokenBHP.MAX_SUPPLY();
    });

    it("Get price, small amounts", async function () {
      const amount = 1;
      const price = await tokenBHP.getPreSalePrice(amount);
      const expectedPrice = parseUnits("0.001", 6);
      expect(expectedPrice).to.equal(price);

      const amount2 = 500;
      const price2 = await tokenBHP.getPreSalePrice(amount2);
      const expectedPrice2 = parseUnits("0.5", 6);
      expect(expectedPrice2).to.equal(price2);
    });

    it("Get price, big amounts", async function () {
      const presaleTokensWei = totalSupply.div(5).toString();
      const presaleTokens = Number(formatUnits(presaleTokensWei, 18));

      const price = await tokenBHP.getPreSalePrice(presaleTokens);
      const expectedPrice = parseUnits("6795600", 6);
      expect(expectedPrice).to.equal(price);
    });

    it("Buy tokens, up to 20%", async function () {
      const [, acc1] = await ethers.getSigners();

      const amount = 64700000;
      const price = await tokenBHP.getPreSalePrice(amount);

      const expectedPrice = parseUnits("64700", 6);
      expect(expectedPrice).to.equal(price);

      await tokenPresale.connect(acc1).approve(tokenBHP.address, price);
      await tokenBHP.connect(acc1).preSaleMint(amount);

      // Check user balance, should have paid tokens
      const acc1Balance = await tokenBHP.balanceOf(acc1.address);
      expect(acc1Balance).to.equal(parseUnits(amount.toString(), 18));
    });

    it("Buy tokens, check payment token balance", async function () {
      const [, acc1] = await ethers.getSigners();

      const amount = 99900000;
      const price = await tokenBHP.getPreSalePrice(amount);
      const paymentInitBalance = await tokenPresale.balanceOf(acc1.address);

      await tokenPresale.connect(acc1).approve(tokenBHP.address, price);
      await tokenBHP.connect(acc1).preSaleMint(amount);

      // Check payment token balance
      const paymentUpdatedBalance = await tokenPresale.balanceOf(acc1.address);
      expect(paymentInitBalance.sub(price)).to.equal(paymentUpdatedBalance);
    });

    it("Buy tokens, up to 40%", async function () {
      const [, acc1] = await ethers.getSigners();

      const amount = 50000000;
      const price = await tokenBHP.getPreSalePrice(amount);
      await tokenPresale.connect(acc1).approve(tokenBHP.address, price);
      await tokenBHP.connect(acc1).preSaleMint(amount);

      // Second mint, same amount shout cost 3 times more - more than 20% sold
      const price2 = await tokenBHP.getPreSalePrice(amount);
      expect(price2).to.equal(price.mul(3));

      // Mint second time
      await tokenPresale.connect(acc1).approve(tokenBHP.address, price2);
      await tokenBHP.connect(acc1).preSaleMint(amount);

      // Account should have 2x amount of tokens
      const acc1Balance = await tokenBHP.balanceOf(acc1.address);
      expect(acc1Balance).to.equal(parseUnits((amount * 2).toString(), 18));
    });

    it("Buy tokens, try to by more than expected", async function () {
      const [, acc1] = await ethers.getSigners();

      const presaleTokensWei = totalSupply.div(5).toString();
      const presaleTokens = Number(formatUnits(presaleTokensWei, 18));

      // Mint 90% of tokens
      const mint1Amount = presaleTokens * 0.9;
      const price = await tokenBHP.getPreSalePrice(mint1Amount);
      await tokenPresale.connect(acc1).approve(tokenBHP.address, price);
      await tokenBHP.connect(acc1).preSaleMint(mint1Amount);

      // Second mint, should fail
      const mint2Amount = presaleTokens * 0.1 + 1;
      const price2 = await tokenBHP.getPreSalePrice(mint2Amount);
      await tokenPresale.connect(acc1).approve(tokenBHP.address, price2);

      await expect(tokenBHP.connect(acc1).preSaleMint(mint2Amount)).to.be.revertedWith("E03: Presale limit reached");
    });
  });

});
