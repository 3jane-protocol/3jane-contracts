import { run } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  NETWORK_NAMES,
  ETHENA_SWAP_SLIPPAGE,
} from "../../constants/constants";

const main = async ({
  network,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer, keeper } = await getNamedAccounts();
  console.log(`21 - Deploying Ethena Deposit Helper on ${network.name}`);

  const chainId = network.config.chainId;
  const networkName = NETWORK_NAMES[chainId];
  const sUSDEThetaVault = await deployments.get("RibbonThetaVaultSUSDEPutWithSwap");

  const constructorArguments = [
    sUSDEThetaVault.address,
    ETHENA_SWAP_SLIPPAGE,
  ];

  const ethenaDepositHelper = await deploy(`EthenaDepositHelper${networkName}`, {
    from: deployer,
    contract: "EthenaDepositHelper",
    args: constructorArguments,
  });

  console.log(`EthenaDepositHelper${networkName} @ ${ethenaDepositHelper.address}`);

  try {
    await run("verify:verify", {
      address: ethenaDepositHelper.address,
      constructorArguments,
    });
  } catch (error) {
    console.log(error);
  }
};
main.tags = ["EthenaDepositHelper"];

export default main;
