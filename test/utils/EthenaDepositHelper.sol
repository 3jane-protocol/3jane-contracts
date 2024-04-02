import { ethers, network } from "hardhat";
import { BigNumber, Contract, utils } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { assert } from "../helpers/assertions";
import { USDE_ADDRESS, SUSDE_ADDRESS } from "../../constants/constants";

describe("EthenaDepositHelper", () => {
  let ethenaDepositHelper: Contract;
  let usde: Contract;
  let susde: Contract;
  let signer: SignerWithAddress;

  const amountAfterSlippage = (
    num: BigNumber,
    slippage: number, // this is a float
    decimals: number = 18
  ) => {
    if (slippage >= 1.0) {
      throw new Error("Slippage cannot exceed 100%");
    }
    const discountValue = ethers.utils
      .parseUnits("1", decimals)
      .sub(ethers.utils.parseUnits(slippage.toFixed(3), decimals));
    return num.mul(discountValue).div(BigNumber.from(10).pow(decimals));
  };

  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: process.env.TEST_URI,
            blockNumber: 19562002,
          },
        },
      ],
    });

    [signer] = await ethers.getSigners();

    usde = await getContractAt("IERC20", USDE_ADDRESS);
    susde = await getContractAt("IERC20", SUSDE_ADDRESS);

    const EthenaThetaVault = await getContractFactory(
      "MockRibbonThetaVault",
      ownerSigner
    );

    ethenaThetaVault = await EthenaDepositHelper.connect(signer).deploy(
      SUSDE_ADDRESS
    );

    const EthenaDepositHelper = await getContractFactory(
      "EthenaDepositHelper",
      ownerSigner
    );

    ethenaDepositHelper = await EthenaDepositHelper.connect(signer).deploy(
      ethenaThetaVault,
      50 // 0.5%
    );
  });

  it("Swaps USDC to SUSDE", async () => {
    const startVaultSUSDEBalance = await SUSDE.balanceOf(ethenaThetaVault.address);

    // DEPOSITING 1 ETH -> stETH vault
    // 1. Find the minSTETHAmount using 0.05% slippage
    const depositAmount = utils.parseEther("1");
    const slippage = 0.005;
    const exchangeSTETHAmount = await curveETHSTETHPool.get_dy(
      0,
      1,
      depositAmount,
      {
        gasLimit: 400000,
      }
    );
    const minSTETHAmount = amountAfterSlippage(exchangeSTETHAmount, slippage);
    await stETHDepositHelper.deposit(minSTETHAmount, {
      value: depositAmount,
    });
    const endVaultSTETHBalance = await stETH.balanceOf(stETHVault.address);

    // 1. The vault should own some stETH
    assert.isAbove(endVaultSTETHBalance, startVaultSTETHBalance);

    // 2. The helper contract should have 1 stETH balance
    // (because stETH transfers suffer from an off-by-1 error)
    assert.equal((await stETH.balanceOf(stETHDepositHelper.address)).toNumber(), 1);
  });
});
