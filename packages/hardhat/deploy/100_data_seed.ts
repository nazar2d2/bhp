import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";
import "@nomiclabs/hardhat-ethers/internal/type-extensions";

/**
 * Update contracts data - initial data seed
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const dataSeed: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();

  const tokenBHP = await hre.ethers.getContract("TokenBHP", deployer);
  const staking = await hre.ethers.getContract("Staking", deployer);
  // const multiSignContract = await hre.ethers.getContract("MultiSigContract", deployer);

  await tokenBHP.setStakingContractAddress(staking.address);
  console.log(`> Staking contract addresses updated`);
};

export default dataSeed;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
dataSeed.tags = [];
