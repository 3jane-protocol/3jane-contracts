import { run } from "hardhat";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  WETH_ADDRESS,
  SUSDE_ADDRESS,
  ETH_USDC_POOL,
  ETH_PRICE_ORACLE,
  USDC_PRICE_ORACLE,
  OptionsPremiumPricerInStables_BYTECODE,
} from "../../constants/constants";
import OptionsPremiumPricerInStables_ABI from "../../constants/abis/OptionsPremiumPricerInStables.json";
import ManualVolOracle_ABI from "../../constants/abis/ManualVolOracle.json";
import {
  MANAGEMENT_FEE,
  PERFORMANCE_FEE,
  PREMIUM_DISCOUNT,
  PERIOD,
} from "../utils/constants";
import { getDeltaStep } from "../../test/helpers/utils";

const main = async ({
  network,
  deployments,
  ethers,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) => {
  const { BigNumber } = ethers;
  const { parseUnits } = ethers.utils;
  const { deploy } = deployments;
  const { deployer, owner, keeper, admin, feeRecipient } =
    await getNamedAccounts();
  console.log(
    `19 - Deploying sUSDe Call Theta Vault With Swap on ${network.name}`
  );

  const manualVolOracle = await deployments.get("ManualVolOracle");
  const vaultDeploymentEventEmitter = await deployments.get("VaultDeploymentEventEmitter");
  const chainId = network.config.chainId;
  const underlyingOracle = ETH_PRICE_ORACLE[chainId];
  const stablesOracle = USDC_PRICE_ORACLE[chainId];

  const manualVolOracleContract = await ethers.getContractAt(
    ManualVolOracle_ABI,
    manualVolOracle.address
  );

  const vaultDeploymentEventEmitterContract = await ethers.getContractAt(
    "IVaultDeploymentEventEmitter",
    vaultDeploymentEventEmitter.address
  );
  const optionId = await manualVolOracleContract.getOptionId(
    getDeltaStep("WETH"),
    WETH_ADDRESS[chainId],
    WETH_ADDRESS[chainId],
    true
  );

  const pricer = await deploy("OptionsPremiumPricerETHWithSwap", {
    from: deployer,
    contract: {
      abi: OptionsPremiumPricerInStables_ABI,
      bytecode: OptionsPremiumPricerInStables_BYTECODE,
    },
    args: [optionId, manualVolOracle.address, underlyingOracle, stablesOracle],
  });

  console.log(`RibbonThetaVaultETHPut pricer @ ${pricer.address}`);

  // Can't verify pricer because it's compiled with 0.7.3

  const strikeSelection = await deploy("ManualStrikeSelectionETHPut", {
    contract: "ManualStrikeSelection",
    from: deployer,
    args: [],
  });

  console.log(
    `RibbonThetaVaultSUSDEPut strikeSelection @ ${strikeSelection.address}`
  );

  try {
    await run("verify:verify", {
      address: strikeSelection.address,
      constructorArguments: [],
    });
  } catch (error) {
    console.log(error);
  }

  const logicDeployment = await deployments.get(
    "RibbonThetaVaultWithSwapLogic"
  );
  const lifecycle = await deployments.get("VaultLifecycleWithSwap");

  const RibbonThetaVault = await ethers.getContractFactory(
    "RibbonThetaVaultWithSwap",
    {
      libraries: {
        VaultLifecycleWithSwap: lifecycle.address,
      },
    }
  );

  const initArgs = [
    {
      _owner: owner,
      _keeper: keeper,
      _feeRecipient: feeRecipient,
      _period: PERIOD,
      _managementFee: MANAGEMENT_FEE,
      _performanceFee: PERFORMANCE_FEE,
      _tokenName: "Ribbon sUSDe Theta Vault",
      _tokenSymbol: "rsUSDe-THETA",
      _optionsPremiumPricer: pricer.address,
      _strikeSelection: strikeSelection.address,
      _premiumDiscount: PREMIUM_DISCOUNT, // deprecated in future swap vault scripts since using paradigm (e.g. 29_uni)
    },
    {
      isPut: true,
      decimals: 18,
      asset: SUSDE_ADDRESS[chainId],
      underlying: WETH_ADDRESS[chainId],
      minimumSupply: BigNumber.from(10).pow(10),
      cap: parseEther("10000000"),
    },
  ];
  const initData = RibbonThetaVault.interface.encodeFunctionData(
    "initialize",
    initArgs
  );

  const proxy = await deploy("RibbonThetaVaultSUSDEPutWithSwap", {
    contract: "AdminUpgradeabilityProxy",
    from: deployer,
    args: [logicDeployment.address, admin, initData],
  });

  await vaultDeploymentEventEmitterContract.newVault(proxy.address, 0); // Always adjust to the correct type of vault: 0-normal; 1-earn; 2-vip; 3-treasury

  console.log(`RibbonThetaVaultSUSDEPutWithSwap @ ${proxy.address}`);

  try {
    await run("verify:verify", {
      address: proxy.address,
      constructorArguments: [logicDeployment.address, admin, initData],
    });
  } catch (error) {
    console.log(error);
  }
};
main.tags = ["RibbonThetaVaultSUSDEPutWithSwap"];
// main.dependencies = ["VaultDeploymentEventEmitter", "ManualVolOracle", "RibbonThetaVaultWithSwapLogic"];

export default main;
