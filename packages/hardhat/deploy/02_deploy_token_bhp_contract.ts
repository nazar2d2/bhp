import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";
import "@nomiclabs/hardhat-ethers/internal/type-extensions";
import { network } from "hardhat";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployBHPContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const [owner, acc1] = await hre.ethers.getSigners();

  let multiSignAddress;
  let preSaleToken = "";
  let royaltyAddress = "";

  if (network.name === "localhost") {
    const tokenPresaleMock = await hre.ethers.getContract("TokenPresaleMock", deployer);
    preSaleToken = tokenPresaleMock.address;
    multiSignAddress = acc1.address;
    royaltyAddress = acc1.address;
  } else if (network.name === "sepolia") {
    preSaleToken = "0x7169d38820dfd117c3fa1f22a697dba58d90ba06";
    multiSignAddress = "0xbB714aeFab7513DA5e7Cab590628B795a70Bb51F";
    royaltyAddress = "0x63Cbd02B71d1258B2593E5f7654876557f86FC9C";
  } else {
    preSaleToken = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
    multiSignAddress = "0xbB714aeFab7513DA5e7Cab590628B795a70Bb51F";
    royaltyAddress = "0x63Cbd02B71d1258B2593E5f7654876557f86FC9C";
  }

  console.log(`> Set multiSign address: ${multiSignAddress}`);

  await deploy("TokenBHP", {
    from: deployer,
    args: [owner.address, "BeHappyProtocol", "BHP", multiSignAddress, preSaleToken, royaltyAddress],
    log: true,
    autoMine: true,
  });

  // Get the deployed contract
  // const yourContract = await hre.ethers.getContract("YourContract", deployer);
};

export default deployBHPContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployBHPContract.tags = ["TokenBHP"];
