// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {
    SafeERC20
} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MockRibbonThetaVault {
    using SafeERC20 for IERC20;

    IERC20 public asset;

    constructor(
        IERC20 _asset
    ) {
        asset = _asset;
    }

    function deposit(uint256 _amount) external {
      asset.safeTransferFrom(msg.sender, address(this), _amount);
    }

    function depositFor(uint256 _amount, address _acct) external {
      asset.safeTransferFrom(msg.sender, address(this), _amount);
    }
}
