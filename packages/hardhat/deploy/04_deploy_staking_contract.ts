import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import "hardhat-deploy/dist/src/type-extensions";
import "@nomiclabs/hardhat-ethers/internal/type-extensions";

/**
 * Deploys a contract named "YourContract" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployStakingContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;
  const [owner] = await hre.ethers.getSigners();

  const tokenBHP = await hre.ethers.getContract("TokenBHP", deployer);

  await deploy("Staking", {
    from: deployer,
    args: [owner.address, tokenBHP.address],
    log: true,
    autoMine: true,
  });
};

export default deployStakingContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourContract
deployStakingContract.tags = ["Staking"];
