// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {ISwap} from "../../interfaces/ISwap.sol";
import {
    IOtoken
} from "../../interfaces/GammaInterface.sol";
import {
    RibbonThetaVaultStorage
} from "../../storage/RibbonThetaVaultStorage.sol";
import {Vault} from "../../libraries/Vault.sol";
import {
    VaultLifecycleWithSwap
} from "../../libraries/VaultLifecycleWithSwap.sol";
import {ShareMath} from "../../libraries/ShareMath.sol";
import {RibbonVault} from "./base/RibbonVault.sol";

/**
 * UPGRADEABILITY: Since we use the upgradeable proxy pattern, we must observe
 * the inheritance chain closely.
 * Any changes/appends in storage variable needs to happen in RibbonThetaVaultStorage.
 * RibbonThetaVault should not inherit from any other contract aside from RibbonVault, RibbonThetaVaultStorage
 */
contract RibbonThetaVaultWithSwap is RibbonVault, RibbonThetaVaultStorage {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using ShareMath for Vault.DepositReceipt;

    /************************************************
     *  IMMUTABLES & CONSTANTS
     ***********************************************/

    // USDC
    address public constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    /// @notice Deprecated: 15 minute timelock between commitAndClose and rollToNexOption.
    uint256 public constant DELAY = 0;

    /// @notice oTokenFactory is the factory contract used to spawn otokens. Used to lookup otokens.
    address public immutable OTOKEN_FACTORY;

    /************************************************
     *  EVENTS
     ***********************************************/

    event OpenShort(
        address indexed options,
        uint256 depositAmount,
        address indexed manager
    );

    event CloseShort(
        address indexed options,
        uint256 withdrawAmount,
        address indexed manager
    );

    event NewOptionStrikeSelected(uint256 strikePrice, uint256 delta);

    event InstantWithdraw(
        address indexed account,
        uint256 amount,
        uint256 round
    );

    event NewOffer(
        uint256 swapId,
        address seller,
        address oToken,
        address biddingToken,
        uint256 minPrice,
        uint256 minBidSize,
        uint256 totalSize
    );

    /************************************************
     *  STRUCTS
     ***********************************************/

    /**
     * @notice Initialization parameters for the vault.
     * @param _owner is the owner of the vault with critical permissions
     * @param _feeRecipient is the address to recieve vault performance and management fees
     * @param _managementFee is the management fee pct.
     * @param _performanceFee is the perfomance fee pct.
     * @param _tokenName is the name of the token
     * @param _tokenSymbol is the symbol of the token
     * @param _optionsPremiumPricer is the address of the contract with the
       black-scholes premium calculation logic
     * @param _strikeSelection is the address of the contract with strike selection logic
     * @param _period is the period between each option sales
     */
    struct InitParams {
        address _owner;
        address _keeper;
        address _feeRecipient;
        uint256 _period;
        uint256 _managementFee;
        uint256 _performanceFee;
        string _tokenName;
        string _tokenSymbol;
        address _optionsPremiumPricer;
        address _strikeSelection;
    }

    /************************************************
     *  CONSTRUCTOR & INITIALIZATION
     ***********************************************/

    /**
     * @notice Initializes the contract with immutable variables
     * @param _oTokenFactory is the contract address for minting new opyn option types (strikes, asset, expiry)
     * @param _gammaController is the contract address for opyn actions
     * @param _marginPool is the contract address for providing collateral to opyn
     * @param _swapContract is the contract address that facilitates bids settlement
     * @param _amplol is the contract address for AMPLOLs
     */
    constructor(
        address _oTokenFactory,
        address _gammaController,
        address _marginPool,
        address _swapContract,
        address _amplol
    ) RibbonVault(_gammaController, _marginPool, _swapContract, _amplol) {
        require(_oTokenFactory != address(0), "!_oTokenFactory");

        OTOKEN_FACTORY = _oTokenFactory;
    }

    /**
     * @notice Initializes the OptionVault contract with storage variables.
     * @param _initParams is the struct with vault initialization parameters
     * @param _vaultParams is the struct with vault general data
     */
    function initialize(
        InitParams calldata _initParams,
        Vault.VaultParams calldata _vaultParams
    ) external initializer {
        baseInitialize(
            _initParams._owner,
            _initParams._keeper,
            _initParams._feeRecipient,
            _initParams._period,
            _initParams._managementFee,
            _initParams._performanceFee,
            _initParams._tokenName,
            _initParams._tokenSymbol,
            _vaultParams
        );
        require(
            _initParams._optionsPremiumPricer != address(0),
            "!_optionsPremiumPricer"
        );
        require(
            _initParams._strikeSelection != address(0),
            "!_strikeSelection"
        );

        optionsPremiumPricer = _initParams._optionsPremiumPricer;
        strikeSelection = _initParams._strikeSelection;
    }

    /************************************************
     *  SETTERS
     ***********************************************/

    /**
     * @notice Sets the new strike selection contract
     * @param newStrikeSelection is the address of the new strike selection contract
     */
    function setStrikeSelection(address newStrikeSelection) external onlyOwner {
        require(newStrikeSelection != address(0), "!newStrikeSelection");
        strikeSelection = newStrikeSelection;
    }

    /**
     * @notice Sets the new options premium pricer contract
     * @param newOptionsPremiumPricer is the address of the new strike selection contract
     */
    function setOptionsPremiumPricer(address newOptionsPremiumPricer)
        external
        onlyOwner
    {
        require(
            newOptionsPremiumPricer != address(0),
            "!newOptionsPremiumPricer"
        );
        optionsPremiumPricer = newOptionsPremiumPricer;
    }

    /**
     * @notice Optionality to set strike price manually
     * Should be called after closeRound if we are setting current week's strike
     * @param strikePrice is the strike price of the new oTokens (decimals = 8)
     */
    function setStrikePrice(uint128 strikePrice) external onlyOwner {
        require(strikePrice > 0, "!strikePrice");
        overriddenStrikePrice = strikePrice;
        lastStrikeOverrideRound = vaultState.round;
    }

    /**
     * @notice Sets oToken Premium
     * @param minPrice is the new oToken Premium in the units of 10**18
     */
    function setMinPrice(uint256 minPrice) external onlyKeeper {
        require(minPrice > 0, "!minPrice");
        currentOtokenPremium = minPrice;
    }

    /************************************************
     *  VAULT OPERATIONS
     ***********************************************/

    /**
     * @notice Withdraws the assets on the vault using the outstanding `DepositReceipt.amount`
     * @param amount is the amount to withdraw
     */
    function withdrawInstantly(uint256 amount) external nonReentrant {
        Vault.DepositReceipt storage depositReceipt =
            depositReceipts[msg.sender];

        uint256 currentRound = vaultState.round;
        require(amount > 0, "!amount");
        require(depositReceipt.round == currentRound, "Invalid round");

        uint256 receiptAmount = depositReceipt.amount;
        require(receiptAmount >= amount, "Exceed amount");

        // Subtraction underflow checks already ensure it is smaller than uint104
        depositReceipt.amount = uint104(receiptAmount.sub(amount));
        vaultState.totalPending = uint128(
            uint256(vaultState.totalPending).sub(amount)
        );

        emit InstantWithdraw(msg.sender, amount, currentRound);

        AMPLOL.burn(msg.sender, amount);
        transferAsset(msg.sender, amount);
    }

    /**
     * @notice Initiates a withdrawal that can be processed once the round completes
     * @param numShares is the number of shares to withdraw
     */
    function initiateWithdraw(uint256 numShares) external nonReentrant {
        _initiateWithdraw(numShares);
        currentQueuedWithdrawShares = currentQueuedWithdrawShares.add(
            numShares
        );
    }

    /**
     * @notice Completes a scheduled withdrawal from a past round. Uses finalized pps for the round
     */
    function completeWithdraw() external nonReentrant {
        uint256 withdrawAmount = _completeWithdraw();
        lastQueuedWithdrawAmount = uint128(
            uint256(lastQueuedWithdrawAmount).sub(withdrawAmount)
        );
    }

    /**
     * @notice Closes the existing short and calculate the shares to mint, new price per share &
      amount of funds to re-allocate as collateral for the new round
     * Since we are incrementing the round here, the options are sold in the beginning of a round
     * instead of at the end of the round. For example, at round 1, we don't sell any options. We
     * start selling options at the beginning of round 2.
     */
    function closeRound() external nonReentrant {
        address oldOption = optionState.currentOption;
        require(
            oldOption != address(0) || vaultState.round == 1,
            "Round closed"
        );
        _closeShort(oldOption);

        uint256 currQueuedWithdrawShares = currentQueuedWithdrawShares;
        (uint256 lockedBalance, uint256 queuedWithdrawAmount) =
            _closeRound(
                uint256(lastQueuedWithdrawAmount),
                currQueuedWithdrawShares
            );

        lastQueuedWithdrawAmount = queuedWithdrawAmount;

        uint256 newQueuedWithdrawShares =
            uint256(vaultState.queuedWithdrawShares).add(
                currQueuedWithdrawShares
            );
        ShareMath.assertUint128(newQueuedWithdrawShares);
        vaultState.queuedWithdrawShares = uint128(newQueuedWithdrawShares);

        currentQueuedWithdrawShares = 0;

        ShareMath.assertUint104(lockedBalance);
        vaultState.lockedAmount = uint104(lockedBalance);

        uint256 nextOptionReady = block.timestamp.add(DELAY);
        require(
            nextOptionReady <= type(uint32).max,
            "Overflow nextOptionReady"
        );
        optionState.nextOptionReadyAt = uint32(nextOptionReady);

        for (uint256 i = 0; i < settledBids.length; i++) {
          delete settledBids[i];
        }
    }

    /**
     * @notice Closes the existing short position for the vault.
     */
    function _closeShort(address oldOption) private {
        uint256 lockedAmount = vaultState.lockedAmount;
        if (oldOption != address(0)) {
            vaultState.lastLockedAmount = uint104(lockedAmount);
        }
        vaultState.lockedAmount = 0;

        optionState.currentOption = address(0);

        if (oldOption != address(0)) {
            uint256 withdrawAmount =
                VaultLifecycleWithSwap.settleShort(GAMMA_CONTROLLER);
            emit CloseShort(oldOption, withdrawAmount, msg.sender);
        }
    }

    /**
     * @notice Sets the next option the vault will be shorting
     */
    function commitNextOption() external onlyKeeper nonReentrant {
        address currentOption = optionState.currentOption;
        require(
            currentOption == address(0) && vaultState.round != 1,
            "Round not closed"
        );

        VaultLifecycleWithSwap.CommitParams memory commitParams =
            VaultLifecycleWithSwap.CommitParams({
                OTOKEN_FACTORY: OTOKEN_FACTORY,
                USDC: USDC,
                collateralAsset: vaultParams.asset,
                currentOption: currentOption,
                delay: DELAY,
                lastStrikeOverrideRound: lastStrikeOverrideRound,
                overriddenStrikePrice: overriddenStrikePrice,
                strikeSelection: strikeSelection,
                optionsPremiumPricer: optionsPremiumPricer,
                period: period
            });

        (address otokenAddress, uint256 strikePrice, uint256 delta) =
            VaultLifecycleWithSwap.commitNextOption(
                commitParams,
                vaultParams,
                vaultState
            );

        emit NewOptionStrikeSelected(strikePrice, delta);

        optionState.nextOption = otokenAddress;
    }

    /**
     * @notice Rolls the vault's funds into a new short position and create a new offer.
     */
    function rollToNextOption() external onlyKeeper nonReentrant {
        address newOption = optionState.nextOption;
        require(newOption != address(0), "!nextOption");

        optionState.currentOption = newOption;
        optionState.nextOption = address(0);
        uint256 lockedBalance = vaultState.lockedAmount;

        emit OpenShort(newOption, lockedBalance, msg.sender);

        VaultLifecycleWithSwap.createShort(
            GAMMA_CONTROLLER,
            MARGIN_POOL,
            newOption,
            lockedBalance
        );

        _createOffer();
    }

    function _createOffer() private {
        address currentOtoken = optionState.currentOption;
        uint256 currOtokenPremium = currentOtokenPremium;

        optionAuctionID = VaultLifecycleWithSwap.createOffer(
            currentOtoken,
            currOtokenPremium,
            SWAP_CONTRACT,
            vaultParams
        );
    }

    /**
     * @notice Settle current offer
     */
    function settleOffer(ISwap.Bid[] calldata bids)
        external
        onlyKeeper
        nonReentrant
    {
        for (uint256 i = 0; i < bids.length; i++) {
          settledBids.push(bids[i]);
        }

        ISwap(SWAP_CONTRACT).settleOffer(optionAuctionID, bids);
    }

    /**
     * @notice Burn the remaining oTokens left over and return premiums
     */
    function burnRemainingOTokens() external onlyKeeper nonReentrant {
      uint256 diff = IOtoken(optionState.currentOption).expiryTimestamp() - (block.timestamp - (block.timestamp % (24 hours)) + (8 hours));

      for (uint256 i = 0; i < settledBids.length; i++) {
        ISwap.Bid memory bid = settledBids[i];
        uint256 unearnedPremiums = bid.sellAmount.mul(diff).div(period * 1 days);
        if(unearnedPremiums > 0){
          transferAsset(bid.buyer, unearnedPremiums);
        }
      }

      VaultLifecycleWithSwap.burnOtokens(
          GAMMA_CONTROLLER,
          optionState.currentOption
      );
    }
}
