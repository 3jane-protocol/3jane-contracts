// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IStrategyManager} from "../interfaces/restaked/IStrategyManager.sol";
import {
    ILiquidityPool,
    ILiquifier,
    IWEETH
} from "../interfaces/restaked/IEtherFi.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    IERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRibbonThetaVault} from "../interfaces/IRibbonThetaVault.sol";

contract EtherFiDepositHelper {
    using SafeERC20 for IERC20;

    ILiquidityPool private constant LIQUIDITY_POOL =
        ILiquidityPool(0x308861A430be4cce5502d0A12724771Fc6DaF216);
    ILiquifier private constant LIQUIFIER =
        ILiquifier(0x9FFDF407cDe9a93c47611799DA23924Af3EF764F);

    IERC20 private constant EETH =
        IERC20(0x35fA164735182de50811E8e2E824cFb9B6118ac2);
    IWEETH private constant WEETH =
        IWEETH(0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee);

    IERC20 private constant STETH =
        IERC20(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    // etherfi options vault
    IRibbonThetaVault public immutable etherFiVault;

    /**
     * @notice Constructor
     * @param _etherFiVault is the contract address for WEETH options vault
     */
    constructor(address _etherFiVault) {
        require(_etherFiVault != address(0), "!etherFiVault");

        etherFiVault = IRibbonThetaVault(_etherFiVault);

        // Pre-approvals (pass-through contract)
        STETH.safeApprove(address(LIQUIFIER), type(uint256).max);
        EETH.safeApprove(address(WEETH), type(uint256).max);
        IERC20(address(WEETH)).safeApprove(_etherFiVault, type(uint256).max);
    }

    /**
     * @notice Deposit ETH
     */
    function depositETH() external payable {
        uint256 shares =
            LIQUIDITY_POOL.deposit{value: msg.value}(address(this));
        _deposit(LIQUIDITY_POOL.amountForShare(shares));
    }

    /**
     * @notice Deposit With Queued Withdrawal
     * @param _queuedWithdrawal The QueuedWithdrawal to be used for the deposit. This is the proof that the user has the re-staked ETH and requested the withdrawals setting the Liquifier contract as the withdrawer.
     */
    function depositWithQueuedWithdrawal(
        IStrategyManager.QueuedWithdrawal calldata _queuedWithdrawal
    ) external {
        uint256 shares =
            LIQUIFIER.depositWithQueuedWithdrawal(
                _queuedWithdrawal,
                address(this)
            );
        _deposit(LIQUIDITY_POOL.amountForShare(shares));
    }

    /**
     * @notice Deposits asset without an approve
     * `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments
     * @param _asset is the asset
     * @param _amount is the amount of `asset` to deposit
     * @param _deadline must be a timestamp in the future
     * @param _v is a valid signature
     * @param _r is a valid signature
     * @param _s is a valid signature
     */
    function depositWithPermit(
        IERC20 _asset,
        uint256 _amount,
        uint256 _deadline,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) external {
        // Sign for transfer approval
        IERC20Permit(address(_asset)).permit(
            msg.sender,
            address(this),
            _amount,
            _deadline,
            _v,
            _r,
            _s
        );

        _deposit(_bring(_asset, _amount));
    }

    /**
     * @notice Deposits asset with approve
     * @param _asset is the asset
     * @param _amount is the amount of `asset` to deposit
     */
    function deposit(IERC20 _asset, uint256 _amount) external {
        _deposit(_bring(_asset, _amount));
    }

    /**
     * @notice Transfers asset in and swaps to EETH
     * @param _asset is the asset
     * @param _amount is the amount of `asset` to deposit
     * @return amount if eeth, shares otherwise
     */
    function _bring(IERC20 _asset, uint256 _amount) internal returns (uint256) {
        _asset.safeTransferFrom(msg.sender, address(this), _amount);

        if (_asset != EETH) {
            uint256 shares =
                LIQUIFIER.depositWithERC20(
                    address(_asset),
                    _amount,
                    address(this)
                );
            return LIQUIDITY_POOL.amountForShare(shares);
        }

        return _amount;
    }

    /**
     * @notice Converts to EETH, wraps to WEETH, deposits into WEETH options vault
     * @param _amount is the amount of EETH
     */
    function _deposit(uint256 _amount) internal {
        // Wrap EETH for WEETH
        uint256 _weethAmt = WEETH.wrap(_amount);
        // Deposit WEETH into etherfi options vault
        etherFiVault.depositFor(_weethAmt, msg.sender);
    }
}
