import { ethers } from "hardhat";
import { TokenBHP, TokenJOMO, TokenPresaleMock } from "../typechain-types";

export type ContractsListParams = {
  TokenBHP: TokenBHP;
  TokenPresaleMock: TokenPresaleMock;
  TokenJOMO: TokenJOMO;
};

export const beforeCommon = async (): Promise<ContractsListParams> => {
  const name = "Token";
  const symbol = "TKN";
  const [owner, acc1, multiSignAddress] = await ethers.getSigners();

  // USDT Mock
  const TokenPresaleMock = await ethers.getContractFactory("TokenPresaleMock");
  const tokenPresaleMock = (await TokenPresaleMock.deploy(owner.address, acc1.address)) as TokenPresaleMock;
  await tokenPresaleMock.deployed();

  // BHP Token
  const TokenBHP = await ethers.getContractFactory("TokenBHP");
  const tokenBHP = (await TokenBHP.deploy(
    owner.address,
    name,
    symbol,
    multiSignAddress.address,
    tokenPresaleMock.address,
  )) as TokenBHP;
  await tokenBHP.deployed();

  // JOMO Token
  const TokenJOMO = await ethers.getContractFactory("TokenJOMO");
  const tokenJOMO = (await TokenJOMO.deploy("Joy Of Missing Out", "JOMO", tokenBHP.address)) as TokenJOMO;
  await tokenJOMO.deployed();

  await tokenBHP.setGovernanceTokenAddress(tokenJOMO.address);

  return {
    TokenBHP: tokenBHP,
    TokenPresaleMock: tokenPresaleMock,
    TokenJOMO: tokenJOMO,
  };
};
