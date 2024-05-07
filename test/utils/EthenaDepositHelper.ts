import { ethers, network } from "hardhat";
import { BigNumber, Contract, utils, constants } from "ethers";
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

  //98%
  let slippage = BigNumber.from(98);

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
      ethenaThetaVault.address
    );
  });

  it("#constructor", async () => {
    assert.equal(
      await ethenaDepositHelper.ethenaVault(),
      ethenaThetaVault.address
    );
    assert.bnGt(
      await usdc.allowance(ethenaDepositHelper.address, TARGET_ADDRESS),
      0
    );
    assert.bnGt(
      await dai.allowance(ethenaDepositHelper.address, TARGET_ADDRESS),
      0
    );
    assert.bnGt(
      await usde.allowance(ethenaDepositHelper.address, susde.address),
      0
    );
    assert.bnGt(
      await susde.allowance(
        ethenaDepositHelper.address,
        ethenaThetaVault.address
      ),
      0
    );
  });

  it("#depositInvalidAsset", async () => {
    let depositAmount = BigNumber.from("100").mul(10 ** 6);

    await expect(
      ethenaDepositHelper.deposit(
        sushi.address,
        depositAmount,
        depositAmount,
        "0x"
      )
    ).to.be.revertedWith("!_asset");
  });

  it("#depositWithPermitUSDC", async () => {
    let depositAmount = BigNumber.from("100").mul(10 ** 6);

    await mintToken(
      usdc,
      USDC_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );

    // Following call fixed at block: (await getQuote(chainId, usdc.address, usde.address, ethenaDepositHelper.address, depositAmount, 1)).tx.data;
    let quote =
      "0x8770ba91000000000000000000000000a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000055b3aee03d8ddf27d2880000000000000000000003416cf6c708da44db2624d63ea0aaef7113527c6200000000000000000000000435664008f38b0650fbc1c9fc971d0a3bc2f1e478b1ccac8";

    let rdmWallet: Wallet = await generateWallet(usdc, depositAmount, signer);

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
      .depositWithPermit(
        usdc.address,
        depositAmount,
        depositAmount
          .mul(BigNumber.from(10).pow(12))
          .mul(slippage)
          .div(BigNumber.from(100)),
        quote,
        constants.MaxUint256,
        v,
        r,
        s
      );

    let out = 95890740833154663191;
    assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
    assert.equal(await ethenaThetaVault.balance(rdmWallet.address), out);
  });

  it("#depositWithPermitUSDE", async () => {
    let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18));

    await mintToken(
      usde,
      USDE_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );

    let rdmWallet: Wallet = await generateWallet(usde, depositAmount, signer);

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
      .depositWithPermit(
        usde.address,
        depositAmount,
        depositAmount,
        "0x",
        constants.MaxUint256,
        v,
        r,
        s
      );

    let out = 96078959250706849469;
    assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
    assert.equal(await ethenaThetaVault.balance(rdmWallet.address), out);
  });

  it("#depositDAI", async () => {
    let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(18));

    await mintToken(
      dai,
      DAI_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );
    await dai
      .connect(signer)
      .approve(ethenaDepositHelper.address, depositAmount);

    // Following call fixed at block: (await getQuote(chainId, dai.address, usde.address, ethenaDepositHelper.address, depositAmount, 1)).tx.data;
    let quote =
      "0x8770ba910000000000000000000000006b175474e89094c44da98b954eedeac495271d0f0000000000000000000000000000000000000000000000056bc75e2d631000000000000000000000000000000000000000000000000000055b6dba782602450e28800000000000000000000048da0965ab2d2cbf1c17c09cfb5cbe67ad5b1406200000000000000000000000435664008f38b0650fbc1c9fc971d0a3bc2f1e478b1ccac8";

    assert.equal(await susde.balanceOf(ethenaThetaVault.address), 0);

    const res = await ethenaDepositHelper.deposit(
      dai.address,
      depositAmount,
      depositAmount.mul(slippage).div(BigNumber.from(100)),
      quote
    );
    let out = 95894247006720711113;
    assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
    assert.equal(await ethenaThetaVault.balance(signer.address), out);
  });

  it("#depositUSDT", async () => {
    let depositAmount = BigNumber.from("100").mul(BigNumber.from(10).pow(6));

    await mintToken(
      usdt,
      USDT_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );
    await usdt
      .connect(signer)
      .approve(ethenaDepositHelper.address, depositAmount);

    // Following call fixed at block: (await getQuote(chainId, usdt.address, usde.address, ethenaDepositHelper.address, depositAmount, 1)).tx.data;
    let quote =
      "0x83800a8e000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec70000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000055c1fdedff0ad5beb280000000000000000000000435664008f38b0650fbc1c9fc971d0a3bc2f1e478b1ccac8";

    assert.equal(await susde.balanceOf(ethenaThetaVault.address), 0);

    const res = await ethenaDepositHelper.deposit(
      usdt.address,
      depositAmount,
      depositAmount
        .mul(BigNumber.from(10).pow(12))
        .mul(slippage)
        .div(BigNumber.from(100)),
      quote
    );
    let out = 95950352868871564882;
    assert.equal(await susde.balanceOf(ethenaThetaVault.address), out);
    assert.equal(await ethenaThetaVault.balance(signer.address), out);
  });

  it("#depositMaxSlippage", async () => {
    let depositAmount = BigNumber.from("15000000").mul(
      BigNumber.from(10).pow(18)
    );

    await mintToken(
      dai,
      DAI_OWNER_ADDRESS[chainId],
      signer.address,
      depositAmount
    );
    await dai
      .connect(signer)
      .approve(ethenaDepositHelper.address, depositAmount);

    // Following call fixed at block: (await getQuote(chainId, dai.address, usde.address, ethenaDepositHelper.address, depositAmount, 50)).tx.data;
    let quote =
      "0x07ed2379000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd090000000000000000000000006b175474e89094c44da98b954eedeac495271d0f0000000000000000000000004c9edd5852cd905f086c759e8383e09bff1e68b3000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd09000000000000000000000000be6eb4acb499f992ba2dac7cad59d56da9e0d8230000000000000000000000000000000000000000000c685fa11e01ec6f000000000000000000000000000000000000000000000000062be2d646b651101448b0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001200000000000000000000000000000000000000000000000000000000000000b15000000000000000000000000000000000000000af7000ac9000a9b000a5100a0c9e75c4800000000000004030201000000000000000000000000000000000000000a2300056e00029d0001ed00a007e5c0d20000000000000000000000000000000000000001c90001190000ff00004f02a0000000000000000000000000000000000000000000000000000000ae9b10813dee63c1e5015777d92f208679db4b9778590fa3cab3ac9e21686b175474e89094c44da98b954eedeac495271d0f51204dece678ceceb27446b35c672dc7d61f30bad69ea0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800443df02124000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009f4e4f3fb341eb78bff90020d6bdbf78f939e0a03fb07f59a73314e73794be0e57ac1b4e5120f55b0f6f2da5ffddb104b58a60f2862745960442f939e0a03fb07f59a73314e73794be0e57ac1b4e00443df02124000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000009db5ba4380282ff901fb5120f36a4ba50c603204c3fc6d2da8b78a7b69cbc67d6b175474e89094c44da98b954eedeac495271d0f00443df02124000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000013c22a7112e87e2f3bfc700a007e5c0d20000000000000000000000000000000000000002ad0001fd0001e300000600a03dd5cfd100a0c9e75c4800000000000000210f020000000000000000000000000000000000000000000001af0001600000b05100d632f22692fac7611d2aa1c0d552930d43caed3ba0b86991c6218b36c1d19d4a2e9eb0ce3606eb480044a6417ed6000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001315d869028281ead38d5100dcef968d416a41cdac0ed8702fac8128a64241a2a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800443df02124000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000008f2c4473ce38537bd9c302a0000000000000000000000000000000000000000000013af0e9bfe064bff72cbeee63c1e500c63b0708e2f7e69cb8a1df0e1389a98c35a76d52a0b86991c6218b36c1d19d4a2e9eb0ce3606eb480020d6bdbf78853d955acef822db058eb8505911ed77f175b99e51205dc1bf6f1e983c0b21efb003c105133736fa0743853d955acef822db058eb8505911ed77f175b99e00443df0212400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001da2808a0171a1e25352600a007e5c0d20000000000000000000000000000000000000004910003e100026500024b00a0c9e75c480000000000002c03020100000000000000000000000000000000000000021d00016d00011e00004e48003058ef90929cb8180174d74c507176cca6835d736b175474e89094c44da98b954eedeac495271d0fbd6015b4000000000000000000000000e37e799d5077682fa0a244d46e5649f71457bd0951001116898dda4015ed8ddefb84b6e8bc24528af2d86b175474e89094c44da98b954eedeac495271d0f0044916955860000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001bec50e625000000000000000000000000000000000000000000000000000000006616274702a000000000000000000000000000000000000000000000000000000029e16d19bdee63c1e50148da0965ab2d2cbf1c17c09cfb5cbe67ad5b14066b175474e89094c44da98b954eedeac495271d0f5120bebc44782c7db0a1a60cb6fe97d0b483032ff1c76b175474e89094c44da98b954eedeac495271d0f00443df02124000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000002664c721f560020d6bdbf78dac17f958d2ee523a2206206994597c13d831ec700a0c9e75c48000000000000002b050200000000000000000000000000000000000000000000014e0000ff0000b05100c9f93163c99695c6526b799ebca2207fdf7d61addac17f958d2ee523a2206206994597c13d831ec700048dae733300000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001beeb008990000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000002a000000000000000000000000000000000000000000000000000000045d56235a3ee63c1e50004c8577958ccc170eb3d2cca76f9d51bc6e42d8fdac17f958d2ee523a2206206994597c13d831ec702a0000000000000000000000000000000000000000000000000000002588f1fc9daee63c1e5003416cf6c708da44db2624d63ea0aaef7113527c6dac17f958d2ee523a2206206994597c13d831ec7512002950460e2b9529d0e00284a5fa2d7bdf3fa4d72a0b86991c6218b36c1d19d4a2e9eb0ce3606eb4800443df021240000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000277e26c51f086df0251c700a0f2fa6b664c9edd5852cd905f086c759e8383e09bff1e68b30000000000000000000000000000000000000000000c57c5ac8d6ca22028916100000000000000004565584d3bdf013480a06c4eca274c9edd5852cd905f086c759e8383e09bff1e68b3111111125421ca6dc452d289314280a0f8842a650020d6bdbf784c9edd5852cd905f086c759e8383e09bff1e68b3111111125421ca6dc452d289314280a0f8842a6500000000000000000000008b1ccac8";

    await expect(
      ethenaDepositHelper.deposit(
        dai.address,
        depositAmount,
        depositAmount,
        quote
      )
    ).to.be.revertedWith("!_usdeBal");
  });
});
