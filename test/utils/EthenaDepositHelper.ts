import { ethers, network } from "hardhat";
import { BigNumber, Contract, utils, constants} from "ethers";
import { assert } from "../helpers/assertions";
import { USDE_ADDRESS, SUSDE_ADDRESS, DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS, TARGET_ADDRESS, USDC_OWNER_ADDRESS } from "../../constants/constants";
const { provider, getContractAt, getContractFactory } = ethers;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { TEST_URI } from "../../scripts/helpers/getDefaultEthersProvider";
import {
  getBlockNum,
  generateWallet,
  getPermitSignature,
  mintToken,
} from "../helpers/utils";
const chainId = network.config.chainId;

describe("EthenaDepositHelper", () => {
  let ethenaDepositHelper: Contract;
  let ethenaThetaVault: Contract;
  let usde: Contract;
  let susde: Contract;
  let usdt: Contract;
  let dai: Contract;
  let usdc: Contract;
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
    // Reset block
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: TEST_URI[chainId],
            blockNumber: 19512740,
          },
        },
      ],
    });

    [signer] = await ethers.getSigners();

    usde = await getContractAt("IERC20", USDE_ADDRESS);
    susde = await getContractAt("IERC20", SUSDE_ADDRESS);
    usdt = await getContractAt("IERC20", USDT_ADDRESS);
    dai = await getContractAt("IERC20", DAI_ADDRESS);
    usdc = await getContractAt("IERC20", USDC_ADDRESS[chainId]);

    const EthenaThetaVault = await getContractFactory(
      "MockRibbonThetaVault",
      signer
    );

    ethenaThetaVault = await EthenaThetaVault.connect(signer).deploy(
      SUSDE_ADDRESS
    );

    const EthenaDepositHelper = await getContractFactory(
      "EthenaDepositHelper",
      signer
    );

    ethenaDepositHelper = await EthenaDepositHelper.connect(signer).deploy(
      ethenaThetaVault.address,
      50 // 0.5%
    );
  });

  it("#constructor", async () => {
      assert.equal(await ethenaDepositHelper.ethenaVault(), ethenaThetaVault.address);
      assert.equal(await ethenaDepositHelper.slippage(), 50);
      assert.bnGt(await usdc.allowance(ethenaDepositHelper.address, TARGET_ADDRESS), 0);
      assert.bnGt(await dai.allowance(ethenaDepositHelper.address, TARGET_ADDRESS), 0);
      assert.bnGt(await usde.allowance(ethenaDepositHelper.address, susde.address), 0);
      assert.bnGt(await susde.allowance(ethenaDepositHelper.address, ethenaThetaVault.address), 0);
  });

  it("#setSlippage", async () => {
      let newSlippage = 40;
      await ethenaDepositHelper.setSlippage(newSlippage);
      assert.equal(await ethenaDepositHelper.slippage(), 40);
  });

  it("#depositWithPermitUSDC", async () => {
      let depositAmount = BigNumber.from("100")

      await mintToken(usdc, USDC_OWNER_ADDRESS[chainId], signer.address, depositAmount);

      console.log((await usdc.balanceOf(signer.address)).toString());

      let rdmWallet: Wallet = await generateWallet(
              usdc,
              depositAmount,
              signer
            );

      const { v, r, s } = await getPermitSignature(
        rdmWallet,
        usdc,
        ethenaDepositHelper.address,
        depositAmount,
        constants.MaxUint256
      );

        const res = await ethenaDepositHelper
     .connect(await ethers.provider.getSigner(rdmWallet.address))
     .depositWithPermit(depositAmount, constants.MaxUint256, v, r, s);

  });

  /*
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
  });*/
});
