// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

// Amplol interface
interface IAmplol {
    function mint(address,uint256) external;
    function burn(address,uint256) external;
}
