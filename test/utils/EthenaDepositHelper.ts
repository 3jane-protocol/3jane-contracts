import { ethers, network } from "hardhat";
import { BigNumber, Contract, utils, constants} from "ethers";
import { assert } from "../helpers/assertions";
import { expect } from "chai";
import {
  USDE_ADDRESS,
  SUSDE_ADDRESS,
  DAI_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  SUSHI_ADDRESS,
  TARGET_ADDRESS,
  USDC_OWNER_ADDRESS,
  USDE_OWNER_ADDRESS,
  DAI_OWNER_ADDRESS,
  USDT_OWNER_ADDRESS,
} from "../../constants/constants";
const { provider, getContractAt, getContractFactory } = ethers;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { TEST_URI } from "../../scripts/helpers/getDefaultEthersProvider";
import {
  getBlockNum,
  generateWallet,
  getPermitSignature,
  getQuote,
  mintToken,
  approve,
} from "../helpers/utils";
import * as time from "../helpers/time";

const chainId = network.config.chainId;

describe("EthenaDepositHelper", () => {
  time.revertToSnapshotAfterEach();

  let ethenaDepositHelper: Contract;
  let ethenaThetaVault: Contract;
  let usde: Contract;
  let susde: Contract;
  let usdt: Contract;
  let dai: Contract;
  let usdc: Contract;
  let sushi: Contract;
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
            blockNumber: 19572557,
          },
        },
      ],
    });

    [signer] = await ethers.getSigners();

    usde = await getContractAt("IERC20", USDE_ADDRESS);
    susde = await getContractAt("IERC20", SUSDE_ADDRESS);
    usdt = await getContractAt("IERC20", USDT_ADDRESS);
    dai = await getContractAt("IERC20", DAI_ADDRESS);
    sushi = await getContractAt("IERC20", SUSHI_ADDRESS[chainId]);
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

  it("#setSlippageTooLow", async () => {
      let newSlippage = 101;
      await expect(
         ethenaDepositHelper.setSlippage(newSlippage)
      ).to.be.revertedWith("!_slippage");
  });

  it("#setSlippage", async () => {
      let newSlippage = 40;
      await ethenaDepositHelper.setSlippage(newSlippage);
      assert.equal(await ethenaDepositHelper.slippage(), 40);
  });


  it("#depositInvalidAsset", async () => {
      let depositAmount = BigNumber.from("100").mul(10 ** 6)

       await expect(
         ethenaDepositHelper.deposit(sushi.address, depositAmount, "0x")
       ).to.be.revertedWith("!_asset");
  });

  it("#depositWithPermitUSDC", async () => {
      let depositAmount = BigNumber.from("100").mul(10 ** 6)

      await mintToken(usdc, USDC_OWNER_ADDRESS[chainId], signer.address, depositAmount);

      // Following call fixed at block: (await getQuote(chainId, usdc.address, usde.address, ethenaDepositHelper.address, depositAmount, 1)).tx.data;
      let quote = "0x8770ba91000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000055b3aee03d8ddf27d2880000000000000000000003416cf6c708da44db2624d63ea0aaef7113527c6200000000000000000000000435664008f38b0650fbc1c9fc971d0a3bc2f1e478b1ccac8";

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

      assert.equal(await susde.balanceOf(ethenaThetaVault.address), 0);

        const res = await ethenaDepositHelper
     .connect(await ethers.provider.getSigner(rdmWallet.address))
     .depositWithPermit(usdc.address, depositAmount, quote, constants.MaxUint256, v, r, s);

     let out = 95890740833154663191;
     assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
     assert.equal(await ethenaThetaVault.balance(rdmWallet.address), out);
  });

  it("#depositWithPermitUSDE", async () => {
      let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18))

      await mintToken(usde, USDE_OWNER_ADDRESS[chainId], signer.address, depositAmount);

      let rdmWallet: Wallet = await generateWallet(
              usde,
              depositAmount,
              signer
            );

      const { v, r, s } = await getPermitSignature(
        rdmWallet,
        usde,
        ethenaDepositHelper.address,
        depositAmount,
        constants.MaxUint256,
        {
          nonce: 0,
          name: "USDe",
          chainId: 1,
          version: "1",
        }
      );

      assert.equal(await susde.balanceOf(ethenaThetaVault.address), 0);

        const res = await ethenaDepositHelper
     .connect(await ethers.provider.getSigner(rdmWallet.address))
     .depositWithPermit(usde.address, depositAmount, "0x", constants.MaxUint256, v, r, s);

     let out = 96078959250706849469;
     assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
     assert.equal(await ethenaThetaVault.balance(rdmWallet.address), out);
  });

  it("#depositDAI", async () => {
      let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18))

      await mintToken(dai, DAI_OWNER_ADDRESS[chainId], signer.address, depositAmount);
      await dai.connect(signer).approve(ethenaDepositHelper.address, depositAmount);

      // Following call fixed at block: (await getQuote(chainId, dai.address, usde.address, ethenaDepositHelper.address, depositAmount, 1)).tx.data;
      let quote = "0x8770ba910000000000000000000000006b175474e89094c44da98b954eedeac495271d0f0000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000000000000000000000000000055b6dba782602450e28800000000000000000000048da0965ab2d2cbf1c17c09cfb5cbe67ad5b1406200000000000000000000000435664008f38b0650fbc1c9fc971d0a3bc2f1e478b1ccac8"

      assert.equal(await susde.balanceOf(ethenaThetaVault.address), 0);

       const res = await ethenaDepositHelper.deposit(dai.address, depositAmount, quote);
       let out = 95894247006720711113;
       assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
       assert.equal(await ethenaThetaVault.balance(signer.address), out);
  });

  it("#depositUSDT", async () => {
      let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(6))

      await mintToken(usdt, USDT_OWNER_ADDRESS[chainId], signer.address, depositAmount);
      await usdt.connect(signer).approve(ethenaDepositHelper.address, depositAmount);

      // Following call fixed at block: (await getQuote(chainId, usdt.address, usde.address, ethenaDepositHelper.address, depositAmount, 1)).tx.data;
      let quote = "0x83800a8e000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000055c1fdedff0ad5beb280000000000000000000000435664008f38b0650fbc1c9fc971d0a3bc2f1e478b1ccac8"

      assert.equal(await susde.balanceOf(ethenaThetaVault.address), 0);

      const res = await ethenaDepositHelper.deposit(usdt.address, depositAmount, quote);
      let out = 95950352868871564882;
      assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
      assert.equal(await ethenaThetaVault.balance(signer.address), out);
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
