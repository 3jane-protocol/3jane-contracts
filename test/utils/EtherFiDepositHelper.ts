import { ethers, network } from "hardhat";
import { BigNumber, Contract, utils, constants } from "ethers";
import { assert } from "../helpers/assertions";
import { expect } from "chai";
import {
  STETH_ADDRESS,
  EETH_ADDRESS,
  WEETH_ADDRESS,
  ETHERFI_LIQUIDITY_POOL_ADDRESS,
  ETHERFI_LIQUIFIER_ADDRESS,
  STETH_OWNER_ADDRESS,
  EETH_OWNER_ADDRESS,
} from "../../constants/constants";
const { provider, getContractAt, getContractFactory } = ethers;
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { TEST_URI } from "../../scripts/helpers/getDefaultEthersProvider";
import {
  getBlockNum,
  generateWallet,
  getPermitSignature,
  mintToken,
  approve,
} from "../helpers/utils";
import * as time from "../helpers/time";

const chainId = network.config.chainId;

describe("EtherFiDepositHelper", () => {
  time.revertToSnapshotAfterEach();

  let etherFiDepositHelper: Contract;
  let etherFiThetaVault: Contract;
  let steth: Contract;
  let eeth: Contract;
  let weeth: Contract;
  let signer: SignerWithAddress;

  before(async () => {
    // Reset block
    await network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: TEST_URI[chainId],
            blockNumber: 19594142,
          },
        },
      ],
    });

    [signer] = await ethers.getSigners();

    steth = await getContractAt("IERC20", STETH_ADDRESS);
    eeth = await getContractAt("IERC20", EETH_ADDRESS);
    weeth = await getContractAt("IERC20", WEETH_ADDRESS);

    const EtherFiThetaVault = await getContractFactory(
      "MockRibbonThetaVault",
      signer
    );

    etherFiThetaVault = await EtherFiThetaVault.connect(signer).deploy(
      WEETH_ADDRESS
    );

    const EtherFiDepositHelper = await getContractFactory(
      "EtherFiDepositHelper",
      signer
    );

    etherFiDepositHelper = await EtherFiDepositHelper.connect(signer).deploy(
      etherFiThetaVault.address
    );
  });

  it("#constructor", async () => {
    assert.equal(
      await etherFiDepositHelper.etherFiVault(),
      etherFiThetaVault.address
    );
    assert.bnGt(
      await steth.allowance(
        etherFiDepositHelper.address,
        ETHERFI_LIQUIFIER_ADDRESS
      ),
      0
    );
    assert.bnGt(
      await eeth.allowance(etherFiDepositHelper.address, WEETH_ADDRESS),
      0
    );
    assert.bnGt(
      await weeth.allowance(
        etherFiDepositHelper.address,
        etherFiThetaVault.address
      ),
      0
    );
  });

  it("#depositETH", async () => {
    let depositAmount = BigNumber.from("10").mul(BigNumber.from(10).pow(18));

    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), 0);

    const res = await etherFiDepositHelper.depositETH({ value: depositAmount });

    console.log((await weeth.balanceOf(etherFiThetaVault.address)).toString());

    let out = 9657399393947164508;
    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), out);
    assert.equal(await etherFiThetaVault.balance(signer.address), out);
  });

  it("#depositWithPermitEETH", async () => {
    let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18));

    await mintToken(
      eeth,
      EETH_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );

    let rdmWallet: Wallet = await generateWallet(eeth, depositAmount, signer);

    const { v, r, s } = await getPermitSignature(
      rdmWallet,
      eeth,
      etherFiDepositHelper.address,
      depositAmount,
      constants.MaxUint256,
      {
        nonce: 0,
        name: "EETH",
        chainId: 1,
        version: "1",
      }
    );

    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), 0);

    const res = await etherFiDepositHelper
      .connect(await ethers.provider.getSigner(rdmWallet.address))
      .depositWithPermit(
        eeth.address,
        depositAmount,
        constants.MaxUint256,
        v,
        r,
        s
      );

    let out = 96573993939471645097;
    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), out);
    assert.equal(await etherFiThetaVault.balance(rdmWallet.address), out);
  });

  it("#depositWithPermitSTETH", async () => {
    let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18));

    await mintToken(
      steth,
      STETH_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );

    let rdmWallet: Wallet = await generateWallet(steth, depositAmount, signer);

    const { v, r, s } = await getPermitSignature(
      rdmWallet,
      steth,
      etherFiDepositHelper.address,
      depositAmount,
      constants.MaxUint256,
      {
        nonce: 0,
        name: "Liquid staked Ether 2.0",
        chainId: 1,
        version: "2",
      }
    );

    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), 0);

    const res = await etherFiDepositHelper
      .connect(await ethers.provider.getSigner(rdmWallet.address))
      .depositWithPermit(
        steth.address,
        depositAmount,
        constants.MaxUint256,
        v,
        r,
        s
      );

    let out = 96573993939471645096;
    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), out);
    assert.equal(await etherFiThetaVault.balance(rdmWallet.address), out);
  });

  it("#depositSTETH", async () => {
    let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18));

    await mintToken(
      steth,
      STETH_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );
    await steth
      .connect(signer)
      .approve(etherFiDepositHelper.address, depositAmount);

    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), 0);

    const res = await etherFiDepositHelper.deposit(
      steth.address,
      depositAmount
    );

    let out = 96573993939471645096;
    assert.equal(await weeth.balanceOf(etherFiThetaVault.address), out);
    assert.equal(await etherFiThetaVault.balance(signer.address), out);
  });
});
