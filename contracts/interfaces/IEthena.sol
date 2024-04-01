// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

interface ISUSDE {
    function deposit(uint256 assets, address receiver) external returns (uint256);
}
