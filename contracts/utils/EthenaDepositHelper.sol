// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";
import {ISUSDE} from "../interfaces/basis/IEthena.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    IERC20Permit
} from "@openzeppelin/contracts/token/ERC20/extensions/draft-IERC20Permit.sol";
import {IERC20Detailed} from "../interfaces/IERC20Detailed.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRibbonThetaVault} from "../interfaces/IRibbonThetaVault.sol";

contract EthenaDepositHelper is Ownable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address private constant TARGET =
        0x111111125421cA6dc452d289314280a0f8842A65;
    IERC20 private constant USDE =
        IERC20(0x4c9EDD5852cd905f086C759E8383e09bff1E68B3);
    ISUSDE private constant SUSDE =
        ISUSDE(0x9D39A5DE30e57443BfF2A8307A4256c8797A3497);

    IERC20 private constant USDT =
        IERC20(0xdAC17F958D2ee523a2206206994597C13D831ec7);
    IERC20 private constant USDC =
        IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC20 private constant DAI =
        IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);

    // sUSDE options vault
    IRibbonThetaVault public immutable ethenaVault;

    /**
     * @notice Constructor
     * @param _ethenaVault is the contract address for sUSDe options vault
     */
    constructor(address _ethenaVault) {
        require(_ethenaVault != address(0), "!_ethenaVault");

        ethenaVault = IRibbonThetaVault(_ethenaVault);

        // Pre-approvals (pass-through contract)
        USDC.safeApprove(TARGET, type(uint256).max);
        DAI.safeApprove(TARGET, type(uint256).max);
        USDE.safeApprove(address(SUSDE), type(uint256).max);
        IERC20(address(SUSDE)).safeApprove(_ethenaVault, type(uint256).max);
    }

    /**
     * @notice Deposits asset without an approve
     * @notice ONLY FOR USDC, WILL FAIL FOR USDT, DAI
     * `v`, `r` and `s` must be a valid `secp256k1` signature from `owner`
     * over the EIP712-formatted function arguments
     * @param _asset is the asset
     * @param _amount is the amount of `asset` to deposit
     * @param _minAmountOut is the min amount of USDE to receive
     * @param _data is the calldata for target contract
     * @param _deadline must be a timestamp in the future
     * @param _v is a valid signature
     * @param _r is a valid signature
     * @param _s is a valid signature
     */
    function depositWithPermit(
        IERC20 _asset,
        uint256 _amount,
        uint256 _minAmountOut,
        bytes calldata _data,
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

        _deposit(_asset, _amount, _minAmountOut, _data);
    }

    /**
     * @notice Deposits asset with approve
     * @param _asset is the asset
     * @param _amount is the amount of `asset` to deposit
     * @param _minAmountOut is the min amount of USDE to receive
     * @param _data is the calldata for target contract
     */
    function deposit(
        IERC20 _asset,
        uint256 _amount,
        uint256 _minAmountOut,
        bytes calldata _data
    ) external {
        _deposit(_asset, _amount, _minAmountOut, _data);
    }

    /**
     * @notice Swaps from USDC,DAI,USDT to USDe
     * @param _asset is the asset (ex: USDC, USDT, DAI)
     * @param _amount is the amount of `_asset` to deposit
     * @param _minAmountOut is the min amount of USDE to receive
     * @param _data is the calldata for target contract
     * @return amount out in USDe
     */
    function _swap(
        IERC20 _asset,
        uint256 _amount,
        uint256 _minAmountOut,
        bytes calldata _data
    ) internal returns (uint256) {
        require(abi.decode(_data[:4], (bytes4)) == 0x07ed2379, "!swap");

        uint256 _usdeBalBefore = USDE.balanceOf(address(this));

        // Double-approve for non-compliant USDT
        if (_asset == USDT) {
            USDT.safeApprove(TARGET, 0);
            USDT.safeApprove(TARGET, _amount);
        }

        (bool success, bytes memory result) = TARGET.call(_data);

        if (!success) {
          // If there is return data, the call reverted without a reason or a custom error.
          if (result.length == 0) revert();
          assembly {
            // We use Yul's revert() to bubble up errors from the target contract.
            revert(add(32, result), mload(result))
          }
        }

        uint256 _usdeBal = USDE.balanceOf(address(this)).sub(_usdeBalBefore);

        // Target call must result in sufficient USDe
        require(_usdeBal >= _minAmountOut, "!_usdeBal");

        return _usdeBal;
    }

    /**
     * @notice Swaps, stakes for sUSDe, deposits into ethena options vault
     * @param _asset is the asset (ex: USDC, USDT, DAI)
     * @param _amount is the amount of `_asset` to deposit
     * @param _minAmountOut is the min amount of USDE to receive
     * @param _data is the calldata for target contract
     */
    function _deposit(
        IERC20 _asset,
        uint256 _amount,
        uint256 _minAmountOut,
        bytes calldata _data
    ) internal {
        require(
            _asset == USDE || _asset == USDC || _asset == USDT || _asset == DAI,
            "!_asset"
        );

        _asset.safeTransferFrom(msg.sender, address(this), _amount);

        // If not USDE then swap for USDE
        if (_asset != USDE) {
            _amount = _swap(_asset, _amount, _minAmountOut, _data);
        }

        // Stake USDE for sUSDE
        uint256 _susdeAmt = SUSDE.deposit(_amount, address(this));
        // Deposit sUSDE into ethena options vault
        ethenaVault.depositFor(_susdeAmt, msg.sender);
    }
}
