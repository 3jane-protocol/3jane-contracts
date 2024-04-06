// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IStrategyManager} from "../interfaces/restaked/IStrategyManager.sol";
import {ILiquidityPool, ILiquifier, IWEETH} from "../interfaces/restaked/IEtherFi.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRibbonThetaVault} from "../interfaces/IRibbonThetaVault.sol";

contract EthenaDepositHelper {
    using SafeERC20 for IERC20;

    ILiquidityPool private constant LIQUIDITY_POOL = ILiquidityPool(0x308861a430be4cce5502d0a12724771fc6daf216);
    ILiquifier private constant LIQUIFIER = ILiquifier(0x9ffdf407cde9a93c47611799da23924af3ef764f);

    IERC20 private constant EETH = IERC20(0x35fA164735182de50811E8e2E824cFb9B6118ac2);
    IWEETH private constant WEETH = IWEETH(0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee);

    IERC20 private constant STETH = IERC20(0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84);

    // WEETH options vault
    IRibbonThetaVault public immutable weethOptionsVault;

    /**
     * @notice Constructor
     * @param _weethOptionsVault is the contract address for WEETH options vault
     */
    constructor(
        address _weethOptionsVault
    ) {
        require(weethOptionsVault != address(0), "!weethOptionsVault");

        weethOptionsVault = IRibbonThetaVault(_weethOptionsVault);

        // Pre-approvals (pass-through contract)
        STETH.safeApprove(address(LIQUIFIER), type(uint256).max);
        EETH.safeApprove(address(WEETH), type(uint256).max);
        WEETH.safeApprove(_weethOptionsVault, type(uint256).max);
    }

     /**
     * @notice Deposits asset without an approve
     * `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments
     * @param _asset is the asset
     * @param _amount is the amount of `asset` to deposit
     * @param _data is the calldata for target contract
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
    * @notice Deposit ETH
    */
    function depositETH() external {
      _deposit(LIQUIDITY_POOL.deposit{value: msg.value}(address(this));
    }

    /**
    * @notice Deposit With Queued Withdrawal
    * @param _queuedWithdrawal The QueuedWithdrawal to be used for the deposit. This is the proof that the user has the re-staked ETH and requested the withdrawals setting the Liquifier contract as the withdrawer.
    */
    function depositWithQueuedWithdrawal(IStrategyManager.QueuedWithdrawal calldata _queuedWithdrawal) external {
      _deposit(LIQUIFIER.depositWithQueuedWithdrawal(_queuedWithdrawal, address(this)));
    }

    /**
    * @notice Transfers asset in and swaps to EETH
    * @param _asset is the asset
    * @param _amount is the amount of `asset` to deposit
    */
    function _bring(IERC20 _asset, uint256 amount) internal returns (uint256){
      _asset.safeTransferFrom(msg.sender, address(this), _amount);

      if(_asset != address(EETH)){
        return LIQUIDITY_POOL.depositWithERC20(_asset, _amount, address(this));
      }

      return amount;
    }

    /**
    * @notice Converts to EETH, wraps to WEETH, deposits into WEETH options vault
    * @param _amount is the amount of EETH
    */
    function _deposit(uint256 _amount) internal {
      // Wrap EETH for WEETH
      uint256 _weethAmt = WEETH.wrap(_amount);
      // Deposit WEETH into WEETH options vault
      weethOptionsVault.depositFor(_weethAmt, msg.sender);
    }
}
