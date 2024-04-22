import { run } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  NETWORK_NAMES,
} from "../../constants/constants";

const main = async ({
  network,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer, keeper } = await getNamedAccounts();
  console.log(`21 - Deploying EtherFi Deposit Helper on ${network.name}`);

  const chainId = network.config.chainId;
  const networkName = NETWORK_NAMES[chainId];
  const weethThetaVault = await deployments.get("RibbonThetaVaultWEETHCallWithSwap");

  const constructorArguments = [
    weethThetaVault.address,
  ];

  const etherfiDepositHelper = await deploy(`EtherfiDepositHelper${networkName}`, {
    from: deployer,
    contract: "EtherfiDepositHelper",
    args: constructorArguments,
  });

  console.log(`EtherfiDepositHelper${networkName} @ ${etherfiDepositHelper.address}`);

  try {
    await run("verify:verify", {
      address: etherfiDepositHelper.address,
      constructorArguments,
    });
  } catch (error) {
    console.log(error);
  }
};
main.tags = ["EtherfiDepositHelper"];

export default main;
