import { ethers, network, artifacts } from "hardhat";
import { increaseTo } from "./time";
import WBTC_ABI from "../../constants/abis/WBTC.json";
import ORACLE_ABI from "../../constants/abis/OpynOracle.json";
import CHAINLINK_PRICER_ABI from "../../constants/abis/ChainLinkPricer.json";
import {
  CHAINID,
  OPTION_PROTOCOL,
  GAMMA_ORACLE,
  GAMMA_WHITELIST,
  GAMMA_WHITELIST_OWNER,
  ORACLE_DISPUTE_PERIOD,
  ORACLE_LOCKING_PERIOD,
  ORACLE_OWNER,
  USDC_ADDRESS,
  APE_ADDRESS,
  RETH_ADDRESS,
  WBTC_ADDRESS,
  SAVAX_ADDRESS,
  BAL_ADDRESS,
  BADGER_ADDRESS,
  SPELL_ADDRESS,
  PERP_ADDRESS,
  YEARN_PRICER_OWNER,
  SAVAX_PRICER,
  GAMMA_CONTROLLER,
  OTOKEN_FACTORY,
  MARGIN_POOL,
  TD_CONTROLLER,
  TD_OTOKEN_FACTORY,
  TD_MARGIN_POOL,
  TD_ORACLE,
  TD_ORACLE_OWNER,
  TD_WHITELIST,
  TD_WHITELIST_OWNER,
  CHAINLINK_WETH_PRICER,
  UNI_ADDRESS,
  WETH_ADDRESS,
  WEETH_ADDRESS,
  ETH_PRICE_ORACLE,
  UNI_PRICE_ORACLE,
  BTC_PRICE_ORACLE,
} from "../../constants/constants";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { wmul } from "../helpers/math";

import { splitSignature } from "ethers/lib/utils";
const { provider } = ethers;
const { parseEther } = ethers.utils;
const chainId = network.config.chainId;

export async function deployProxy(
  logicContractName: string,
  adminSigner: SignerWithAddress,
  initializeArgs: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  logicDeployParams = [],
  factoryOptions = {}
) {
  const AdminUpgradeabilityProxy = await ethers.getContractFactory(
    "AdminUpgradeabilityProxy",
    adminSigner
  );
  const LogicContract = await ethers.getContractFactory(
    logicContractName,
    factoryOptions || {}
  );
  const logic = await LogicContract.deploy(...logicDeployParams);

  const initBytes = LogicContract.interface.encodeFunctionData(
    "initialize",
    initializeArgs
  );

  const proxy = await AdminUpgradeabilityProxy.deploy(
    logic.address,
    await adminSigner.getAddress(),
    initBytes
  );
  return await ethers.getContractAt(logicContractName, proxy.address);
}

export async function deployProxyAutocall(
  logicContractName: string,
  adminSigner: SignerWithAddress,
  initializeArgs: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  logicDeployParams = [],
  factoryOptions = {}
) {
  const AdminUpgradeabilityProxy = await ethers.getContractFactory(
    "AdminUpgradeabilityProxy",
    adminSigner
  );
  const LogicContract = await ethers.getContractFactory(
    logicContractName,
    factoryOptions || {}
  );
  const logic = await LogicContract.deploy(...logicDeployParams);

  const initBytes = LogicContract.interface.encodeFunctionData(
    "initialize((address,address,address,uint256,uint256,string,string,address,address,uint32,uint256,uint256,uint256,uint256),(bool,uint8,address,address,uint56,uint104),uint8,(uint8,uint8,uint256,uint256,uint256,uint256),uint256,address)",
    initializeArgs
  );

  const proxy = await AdminUpgradeabilityProxy.deploy(
    logic.address,
    await adminSigner.getAddress(),
    initBytes
  );
  return await ethers.getContractAt(logicContractName, proxy.address);
}

export async function getBlockNum(asset: string, chainId: number) {
  if (asset === PERP_ADDRESS[chainId]) {
    return 14087600;
  } else if (asset === BAL_ADDRESS[chainId]) {
    return 15012740;
  } else if (asset === SPELL_ADDRESS[chainId]) {
    return 15140525;
  } else if (asset === UNI_ADDRESS[chainId]) {
    return 16000050;
  } else if (asset === BADGER_ADDRESS[chainId]) {
    return 15012740;
  } else if (asset === WBTC_ADDRESS[chainId]){
    return 15012740;
  } else {
    return 19672061;
  }
}

export async function parseLog(
  contractName: string,
  log: { topics: string[]; data: string }
) {
  if (typeof contractName !== "string") {
    throw new Error("contractName must be string");
  }
  const abi = (await artifacts.readArtifact(contractName)).abi;
  const iface = new ethers.utils.Interface(abi);
  const event = iface.parseLog(log);
  return event;
}

export async function mintAndApprove(
  tokenAddress: string,
  userSigner: SignerWithAddress,
  spender: string,
  amount: BigNumber
) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: ["0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"],
  });
  const wbtcMinter = await ethers.provider.getSigner(
    "0xca06411bd7a7296d7dbdd0050dfc846e95febeb7"
  );
  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
  await forceSend.deployed();
  await forceSend.go("0xca06411bd7a7296d7dbdd0050dfc846e95febeb7", {
    value: parseEther("1"),
  });

  const WBTCToken = await ethers.getContractAt(WBTC_ABI, tokenAddress);
  await WBTCToken.connect(wbtcMinter).mint(userSigner.address, amount);
  await WBTCToken.connect(userSigner).approve(
    spender,
    amount.mul(BigNumber.from("10"))
  );
}

export async function getAssetPricer(
  pricer: string,
  signer: SignerWithAddress
) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [pricer],
  });

  const ownerSigner = await provider.getSigner(pricer);

  const pricerContract = await ethers.getContractAt("IYearnPricer", pricer);

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
  await forceSend.connect(signer).go(pricer, { value: parseEther("0.5") });

  return await pricerContract.connect(ownerSigner);
}

export async function setAssetPricer(
  asset: string,
  pricer: string,
  protocol: OPTION_PROTOCOL
) {
  const oracleAddr =
    protocol === OPTION_PROTOCOL.GAMMA
      ? GAMMA_ORACLE[chainId]
      : TD_ORACLE[chainId];
  const oracleOwnerAddr =
    protocol === OPTION_PROTOCOL.GAMMA
      ? ORACLE_OWNER[chainId]
      : TD_ORACLE_OWNER[chainId];

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [oracleOwnerAddr],
  });

  const ownerSigner = await provider.getSigner(oracleOwnerAddr);

  const oracle = await ethers.getContractAt("IOracle", oracleAddr);

  await oracle.connect(ownerSigner).setAssetPricer(asset, pricer);
}

export async function whitelistProduct(
  underlying: string,
  strike: string,
  collateral: string,
  isPut: boolean,
  protocol: OPTION_PROTOCOL
) {
  const [adminSigner] = await ethers.getSigners();
  const whitelistAddr =
    protocol === OPTION_PROTOCOL.GAMMA
      ? GAMMA_WHITELIST[chainId]
      : TD_WHITELIST[chainId];
  const whitelistOwnerAddr =
    protocol === OPTION_PROTOCOL.GAMMA
      ? GAMMA_WHITELIST_OWNER[chainId]
      : TD_WHITELIST_OWNER[chainId];

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whitelistOwnerAddr],
  });

  const ownerSigner = await provider.getSigner(whitelistOwnerAddr);

  const whitelist = await ethers.getContractAt(
    "IGammaWhitelist",
    whitelistAddr
  );

  await adminSigner.sendTransaction({
    to: whitelistOwnerAddr,
    value: parseEther("5"),
  });

  await whitelist.connect(ownerSigner).whitelistCollateral(collateral);

  await whitelist
    .connect(ownerSigner)
    .whitelistProduct(underlying, strike, collateral, isPut);
}

export async function setupOracle(
  assetAddr: string,
  chainlinkPricer: string,
  signer: SignerWithAddress,
  protocol: OPTION_PROTOCOL,
  collateralAssetAddr: string = ""
) {
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [chainlinkPricer],
  });

  const oracleAddr =
    protocol === OPTION_PROTOCOL.GAMMA
      ? GAMMA_ORACLE[chainId]
      : TD_ORACLE[chainId];
  const oracleOwnerAddr =
    protocol === OPTION_PROTOCOL.GAMMA
      ? ORACLE_OWNER[chainId]
      : TD_ORACLE_OWNER[chainId];

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [oracleOwnerAddr],
  });
  const oracleOwnerSigner = await provider.getSigner(oracleOwnerAddr);

  const pricerSigner = await provider.getSigner(chainlinkPricer);

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
  await forceSend
    .connect(signer)
    .go(chainlinkPricer, { value: parseEther("10") });

  const oracle = new ethers.Contract(oracleAddr, ORACLE_ABI, pricerSigner);

  await signer.sendTransaction({
    to: oracleOwnerAddr,
    value: parseEther("1"),
  });

  await oracle
    .connect(oracleOwnerSigner)
    .setStablePrice(USDC_ADDRESS[chainId], "100000000");

  if (protocol === OPTION_PROTOCOL.GAMMA) {
    if (collateralAssetAddr === RETH_ADDRESS[chainId]) {
      await oracle
        .connect(oracleOwnerSigner)
        .setAssetPricer(assetAddr, CHAINLINK_WETH_PRICER[chainId]);

      await oracle
        .connect(oracleOwnerSigner)
        .setAssetPricer(collateralAssetAddr, chainlinkPricer);
    } else {
      if (
        collateralAssetAddr !== "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE"
      ) {
        await oracle
          .connect(oracleOwnerSigner)
          .setAssetPricer(assetAddr, chainlinkPricer);
      }
    }
  } else {
    if (collateralAssetAddr === RETH_ADDRESS[chainId]) {
      await oracle
        .connect(oracleOwnerSigner)
        .updateAssetPricer(assetAddr, CHAINLINK_WETH_PRICER[chainId]);

      await oracle
        .connect(oracleOwnerSigner)
        .updateAssetPricer(collateralAssetAddr, chainlinkPricer);
    } else {
      if (
        collateralAssetAddr !== "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE"
      ) {
        await oracle
          .connect(oracleOwnerSigner)
          .updateAssetPricer(assetAddr, chainlinkPricer);
      }
    }
  }

  return oracle;
}

export async function setOpynOracleExpiryPrice(
  asset: string,
  oracle: Contract,
  expiry: BigNumber,
  settlePrice: BigNumber,
  collateralAsset: string = ""
) {
  await increaseTo(expiry.toNumber() + ORACLE_LOCKING_PERIOD + 1);

  let receipt;

  if (collateralAsset === RETH_ADDRESS[chainId]) {
    const res = await oracle.setExpiryPrice(
      collateralAsset,
      expiry,
      settlePrice
    );
    await res.wait();

    const forceSendContract = await ethers.getContractFactory("ForceSend");
    const forceSend = await forceSendContract.deploy(); // force Send is a contract that forces the sending of Ether to WBTC minter (which is a contract with no receive() function)
    await forceSend
      .connect(oracle.signer)
      .go(CHAINLINK_WETH_PRICER[chainId], { value: parseEther("3") });

    await network.provider.request({
      method: "hardhat_impersonateAccount",
      params: [CHAINLINK_WETH_PRICER[chainId]],
    });
    const pricerSigner = await provider.getSigner(
      CHAINLINK_WETH_PRICER[chainId]
    );
    let oracle2 = new ethers.Contract(oracle.address, ORACLE_ABI, pricerSigner);
    const res2 = await oracle2.setExpiryPrice(asset, expiry, settlePrice);
    receipt = await res2.wait();
  } else {
    if (collateralAsset === "0xa354F35829Ae975e850e23e9615b11Da1B3dC4DE") {
      const pricerAddress = await oracle.getPricer(asset);
      await getAssetPricer(pricerAddress, oracle.signer as SignerWithAddress);
      const pricerSigner = provider.getSigner(pricerAddress);
      const res = await oracle
        .connect(pricerSigner)
        .setExpiryPrice(asset, expiry, settlePrice);
      receipt = await res.wait();
    } else {
      const res = await oracle.setExpiryPrice(asset, expiry, settlePrice);
      receipt = await res.wait();
    }
  }
  const timestamp = (await provider.getBlock(receipt.blockNumber)).timestamp;

  await increaseTo(timestamp + ORACLE_DISPUTE_PERIOD + 1);
}

export async function setOpynOracleExpiryPriceYearn(
  underlyingAsset: string,
  underlyingOracle: Contract,
  underlyingSettlePrice: BigNumber,
  collateralPricer: Contract,
  expiry: BigNumber
) {
  await increaseTo(expiry.toNumber() + ORACLE_LOCKING_PERIOD + 1);

  const res = await underlyingOracle.setExpiryPrice(
    underlyingAsset,
    expiry,
    underlyingSettlePrice
  );
  await res.wait();
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [YEARN_PRICER_OWNER],
  });

  const oracleOwnerSigner = await provider.getSigner(YEARN_PRICER_OWNER);
  const res2 = await collateralPricer
    .connect(oracleOwnerSigner)
    .setExpiryPriceInOracle(expiry);
  const receipt = await res2.wait();

  const timestamp = (await provider.getBlock(receipt.blockNumber)).timestamp;
  await increaseTo(timestamp + ORACLE_DISPUTE_PERIOD + 1);
}

export async function addMinter(
  contract: Contract,
  contractOwner: string,
  minter: string
) {
  const tokenOwnerSigner = await ethers.provider.getSigner(contractOwner);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [contractOwner],
  });

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // Some contract do not have receive(), so we force send
  await forceSend.deployed();
  await forceSend.go(contractOwner, {
    value: parseEther("10"),
  });

  await contract.connect(tokenOwnerSigner).addMinter(minter);

  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [contractOwner],
  });
}

export async function mintToken(
  contract: Contract,
  contractOwner: string,
  recipient: string,
  spender: string,
  amount: BigNumberish
) {

  const tokenOwnerSigner = await ethers.provider.getSigner(contractOwner);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [contractOwner],
  });

  const forceSendContract = await ethers.getContractFactory("ForceSend");
  const forceSend = await forceSendContract.deploy(); // Some contract do not have receive(), so we force send
  await forceSend.deployed();
  await forceSend.go(contractOwner, {
    value: parseEther("10"),
  });

  if (isBridgeToken(chainId, contract.address)) {
    // Avax mainnet uses BridgeTokens which have a special mint function
    const txid = ethers.utils.formatBytes32String("Hello World!");
    await contract
      .connect(tokenOwnerSigner)
      .mint(recipient, amount, recipient, 0, txid);
  } else if (
    contract.address === USDC_ADDRESS[chainId] ||
    contract.address === SAVAX_ADDRESS[chainId] ||
    contract.address === APE_ADDRESS[chainId] ||
    contract.address === BADGER_ADDRESS[chainId] ||
    contract.address === BAL_ADDRESS[chainId] ||
    contract.address === SPELL_ADDRESS[chainId] ||
    contract.address === RETH_ADDRESS[chainId] ||
    contract.address === UNI_ADDRESS[chainId] ||
    contract.address === WEETH_ADDRESS
  ) {
    await contract.connect(tokenOwnerSigner).transfer(recipient, amount);
  } else {
    await contract.connect(tokenOwnerSigner).mint(recipient, amount);
  }

  const recipientSigner = await ethers.provider.getSigner(recipient);
  await contract.connect(recipientSigner).approve(spender, amount);

  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [contractOwner],
  });
}

export const isBridgeToken = (chainId: number, address: string) =>
  chainId === CHAINID.AVAX_MAINNET &&
  (address === WBTC_ADDRESS[chainId] || address === USDC_ADDRESS[chainId]);

export interface Bid {
  swapId: number;
  nonce: number;
  signerWallet: string;
  buyer: string;
  sellAmount: BigNumberish;
  buyAmount: BigNumberish;
  referrer: string;
}

export async function generateSignedBid(
  chainId: number,
  swapContractAddress: string,
  contractSigner: string,
  bid: Bid
) {
  const domain = {
    name: "3JANE SWAP", // This is set as a constant in the swap contract
    version: "1", // This is set as a constant in the swap contract
    chainId,
    verifyingContract: swapContractAddress,
  };

  const types = {
    Bid: [
      { name: "swapId", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "signerWallet", type: "address" },
      { name: "buyer", type: "address" },
      { name: "sellAmount", type: "uint256" },
      { name: "buyAmount", type: "uint256" },
      { name: "referrer", type: "address" },
    ],
  };

  const userSigner = ethers.provider.getSigner(contractSigner);

  /* eslint no-underscore-dangle: 0 */
  const signedMsg = await userSigner._signTypedData(domain, types, bid);

  const signature = signedMsg.substring(2);

  return {
    ...bid,
    v: parseInt(signature.substring(128, 130), 16),
    r: "0x" + signature.substring(0, 64),
    s: "0x" + signature.substring(64, 128),
  };
}

export async function bidForOToken(
  gnosisAuction: Contract,
  assetContract: Contract,
  contractSigner: string,
  oToken: string,
  premium: BigNumber,
  assetDecimals: number,
  multiplier: string,
  auctionDuration: number
) {
  const userSigner = await ethers.provider.getSigner(contractSigner);

  const latestAuction = (await gnosisAuction.auctionCounter()).toString();
  const totalOptionsAvailableToBuy = BigNumber.from(
    await (
      await ethers.getContractAt("IERC20", oToken)
    ).balanceOf(gnosisAuction.address)
  )
    .mul(await gnosisAuction.FEE_DENOMINATOR())
    .div(
      (await gnosisAuction.FEE_DENOMINATOR()).add(
        await gnosisAuction.feeNumerator()
      )
    )
    .div(multiplier);

  let bid = wmul(
    totalOptionsAvailableToBuy.mul(BigNumber.from(10).pow(10)),
    premium
  );
  bid =
    assetDecimals > 18
      ? bid.mul(BigNumber.from(10).pow(assetDecimals - 18))
      : bid.div(BigNumber.from(10).pow(18 - assetDecimals));

  const queueStartElement =
    "0x0000000000000000000000000000000000000000000000000000000000000001";

  await assetContract
    .connect(userSigner)
    .approve(gnosisAuction.address, bid.toString());

  // BID OTOKENS HERE
  await gnosisAuction
    .connect(userSigner)
    .placeSellOrders(
      latestAuction,
      [totalOptionsAvailableToBuy.toString()],
      [bid.toString()],
      [queueStartElement],
      "0x"
    );

  await increaseTo(
    (await provider.getBlock("latest")).timestamp + auctionDuration
  );

  return [latestAuction, totalOptionsAvailableToBuy, bid];
}

export async function lockedBalanceForRollover(vault: Contract) {
  let currentBalance = await vault.totalBalance();
  let newPricePerShare = await vault.pricePerShare();

  let queuedWithdrawAmount = await sharesToAsset(
    (
      await vault.vaultState()
    ).queuedWithdrawShares,
    newPricePerShare,
    (
      await vault.vaultParams()
    ).decimals
  );

  let balanceSansQueued = currentBalance.sub(queuedWithdrawAmount);
  return [balanceSansQueued, queuedWithdrawAmount];
}

export async function closeAuctionAndClaim(
  gnosisAuction: Contract,
  thetaVault: Contract,
  vault: Contract,
  signer: string
) {
  const userSigner = await ethers.provider.getSigner(signer);
  await gnosisAuction
    .connect(userSigner)
    .settleAuction(await thetaVault.optionAuctionID());
  await vault.claimAuctionOtokens();
}

export interface Order {
  sellAmount: BigNumber;
  buyAmount: BigNumber;
  userId: BigNumber;
}

export function decodeOrder(bytes: string): Order {
  return {
    userId: BigNumber.from("0x" + bytes.substring(2, 18)),
    sellAmount: BigNumber.from("0x" + bytes.substring(43, 66)),
    buyAmount: BigNumber.from("0x" + bytes.substring(19, 42)),
  };
}

export function encodeOrder(order: Order): string {
  return (
    "0x" +
    order.userId.toHexString().slice(2).padStart(16, "0") +
    order.buyAmount.toHexString().slice(2).padStart(24, "0") +
    order.sellAmount.toHexString().slice(2).padStart(24, "0")
  );
}

async function sharesToAsset(
  shares: BigNumber,
  assetPerShare: BigNumber,
  decimals: BigNumber
) {
  return shares
    .mul(assetPerShare)
    .div(BigNumber.from(10).pow(decimals.toString()));
}

/* eslint @typescript-eslint/no-explicit-any: "off" */
export const objectEquals = (a: any, b: any) => {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  if (!a || !b || (typeof a !== "object" && typeof b !== "object"))
    return a === b;
  /* eslint no-undefined: "off" */
  if (a === null || a === undefined || b === null || b === undefined)
    return false;
  if (a.prototype !== b.prototype) return false;
  let keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => objectEquals(a[k], b[k]));
};

export const serializeMap = (map: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.keys(map).map((key) => {
      return [key, serializeToObject(map[key])];
    })
  );
};

export const serializeToObject = (solidityValue: unknown) => {
  if (BigNumber.isBigNumber(solidityValue)) {
    return solidityValue.toString();
  }
  // Handle structs recursively
  if (Array.isArray(solidityValue)) {
    return solidityValue.map((val) => serializeToObject(val));
  }
  return solidityValue;
};

export const getDeltaStep = (asset: string) => {
  switch (asset) {
    case "WBTC":
      return BigNumber.from("1000");
    case "AAVE":
      return BigNumber.from("10");
    case "SAVAX":
    case "APE":
      return BigNumber.from("5");
    case "SUSHI":
    case "UNI":
      return BigNumber.from("1");
    case "BAL":
    case "SPELL":
    case "BADGER":
      return BigNumber.from("0");
    case "WETH":
      if (chainId === CHAINID.AVAX_MAINNET) {
        return BigNumber.from("3");
      }
      return BigNumber.from("100");
    default:
      throw new Error(`Delta Step not found for asset: ${asset}`);
  }
};

export const getPricerAsset = async (pricer: Contract) => {
  switch (pricer.address) {
    case SAVAX_PRICER:
      return await pricer.sAVAX();
    default:
      return await pricer.asset();
  }
};

export const getPremiumPricerFromAsset = (asset: string) => {
  switch (asset) {
    case WETH_ADDRESS[chainId]:
      return ETH_PRICE_ORACLE[chainId];
    case UNI_ADDRESS[chainId]:
      return UNI_PRICE_ORACLE[chainId];
    default:
      return BTC_PRICE_ORACLE[chainId];
  }
};

export const getProtocolAddresses = (
  protocol: OPTION_PROTOCOL,
  chainId: number
) => {
  switch (protocol) {
    case OPTION_PROTOCOL.GAMMA:
      return [
        GAMMA_CONTROLLER[chainId],
        OTOKEN_FACTORY[chainId],
        MARGIN_POOL[chainId],
        ORACLE_OWNER[chainId],
      ];
    case OPTION_PROTOCOL.TD:
      return [
        TD_CONTROLLER[chainId],
        TD_OTOKEN_FACTORY[chainId],
        TD_MARGIN_POOL[chainId],
        TD_ORACLE_OWNER[chainId],
      ];
    default:
      throw new Error("Protocol not found");
  }
};

export const getAuctionMinPrice = async (
  gnosisAuction: Contract,
  tokenDecimals: number
) => {
  const auctionDetails = await gnosisAuction.auctionData(
    await gnosisAuction.auctionCounter()
  );
  const initialAuctionOrder = decodeOrder(auctionDetails.initialAuctionOrder);
  const minPriceE18 = initialAuctionOrder.buyAmount
    .mul(BigNumber.from(10).pow(36 - tokenDecimals))
    .div(initialAuctionOrder.sellAmount.mul(BigNumber.from(10).pow(10)));
  return minPriceE18;
};

export async function getPermitSignature(
  wallet,
  token: Contract,
  spender: string,
  value: BigNumberish,
  deadline: BigNumberish,
  permitConfig?: {
    nonce: BigNumberish;
    name: string;
    chainId: number;
    version: string;
  }
): Promise<Signature> {
  const [nonce, name, version, chainId] = await Promise.all([
    permitConfig?.nonce ?? "0",
    permitConfig?.name ?? "USD Coin",
    permitConfig?.version ?? "2",
    permitConfig?.chainId ?? "1",
  ]);

  return splitSignature(
    await wallet._signTypedData(
      {
        name,
        version,
        chainId,
        verifyingContract: token.address,
      },
      {
        Permit: [
          {
            name: "owner",
            type: "address",
          },
          {
            name: "spender",
            type: "address",
          },
          {
            name: "value",
            type: "uint256",
          },
          {
            name: "nonce",
            type: "uint256",
          },
          {
            name: "deadline",
            type: "uint256",
          },
        ],
      },
      {
        owner: wallet.address,
        spender,
        value,
        nonce,
        deadline,
      }
    )
  );
}

export async function generateWallet(
  asset: Contract,
  amount: BigNumber,
  owner: SignerWithAddress
) {
  let provider = new ethers.providers.JsonRpcProvider(process.env.TEST_URI);
  let signer = new ethers.Wallet(
    "0ce495bd7bab5341ae5a7ac195173fba1aa56f6561e35e1fec6176e2519ab8da",
    provider
  );

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [signer.address],
  });

  await asset.connect(owner).transfer(signer.address, amount);

  // Create a transaction object
  let tx = {
    to: signer.address,
    // Convert currency unit from ether to wei
    value: ethers.utils.parseEther("10"),
  };

  await owner.sendTransaction(tx);

  return signer;
}

export async function approve(
  contract: Contract,
  approver: string,
  spender: string,
  amount: BigNumberish
) {
  const tokenOwnerSigner = await ethers.provider.getSigner(approver);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [approver],
  });

  await contract.connect(tokenOwnerSigner).approve(spender, amount);

  await network.provider.request({
    method: "hardhat_stopImpersonatingAccount",
    params: [approver],
  });
}

export async function getQuote(chainId: number, src: string, dst: string, from: string, amount: BigNumberish, slippage: number, disableEstimate = true) {
  const axios = require("axios");

  const url = `https://api.1inch.dev/swap/v6.0/${chainId}/swap`;

  const config = {
      headers: {
      "Authorization": `Bearer ${process.env.ONE_INCH_KEY}`
      },
      params: {
          "src": src,
          "dst": dst,
          "amount": amount.toString(),
          "from": from,
          "slippage": slippage,
          "disableEstimate": disableEstimate
      }
  };

  try {
    const response = await axios.get(url, config);
    return response.data;
  } catch (error) {
    console.error(error);
    return nil
  }
}
