// SPDX-License-Identifier: MIT
pragma solidity ^0.8.15;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ISUSDE is IERC20{
    function deposit(uint256 assets, address receiver) external returns (uint256);
}
