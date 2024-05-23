import { run } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  OTOKEN_FACTORY,
  MARGIN_POOL,
  GAMMA_CONTROLLER,
  AMPLOL,
} from "../../constants/constants";

const main = async ({
  network,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log(`18 - Deploying Theta Vault with Swap logic on ${network.name}`);

  const chainId = network.config.chainId;

  const swapAddress = (await deployments.get("Swap")).address;

  const lifecycle = await deploy("VaultLifecycleWithSwap", {
    contract: "VaultLifecycleWithSwap",
    from: deployer,
  });

  const vault = await deploy("RibbonThetaVaultWithSwapLogic", {
    contract: "RibbonThetaVaultWithSwap",
    from: deployer,
    args: [
      OTOKEN_FACTORY[chainId],
      GAMMA_CONTROLLER[chainId],
      MARGIN_POOL[chainId],
      swapAddress,
      AMPLOL,
    ],
    libraries: {
      VaultLifecycleWithSwap: lifecycle.address,
    },
  });

  console.log(`RibbonThetaVaultWithSwapLogic @ ${vault.address}`);

  try {
    await run("verify:verify", {
      address: lifecycle.address,
      constructorArguments: [],
    });
  } catch (error) {
    console.log(error);
  }

  try {
    await run("verify:verify", {
      address: vault.address,
      constructorArguments: [
        OTOKEN_FACTORY[chainId],
        GAMMA_CONTROLLER[chainId],
        MARGIN_POOL[chainId],
        swapAddress,
        AMPLOL,
      ],
    });
  } catch (error) {
    console.log(error);
  }
};
main.tags = ["RibbonThetaVaultWithSwapLogic"];
main.dependencies = [];

export default main;
