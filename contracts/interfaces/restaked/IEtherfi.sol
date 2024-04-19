// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStrategyManager} from "./IStrategyManager.sol";

interface IWEETH is IERC20 {
    function wrap(uint256 assets) external returns (uint256);
}

interface ILiquidityPool {
    function deposit(address _referral) external payable returns (uint256);

    function amountForShare(uint256 _share) external view returns (uint256);
}

interface ILiquifier {
    struct PermitInput {
        uint256 value;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    /// the users mint eETH given the queued withdrawal for their LRT with withdrawer == address(this)
    /// charge a small fixed amount fee to compensate for the gas cost for claim
    /// @param _queuedWithdrawal The QueuedWithdrawal to be used for the deposit. This is the proof that the user has the re-staked ETH and requested the withdrawals setting the Liquifier contract as the withdrawer.
    /// @param _referral The referral address
    /// @return mintedAmount the amount of eETH minted to the caller (= msg.sender)
    function depositWithQueuedWithdrawal(
        IStrategyManager.QueuedWithdrawal calldata _queuedWithdrawal,
        address _referral
    ) external returns (uint256);

    /// Deposit Liquid Staking Token such as stETH and Mint eETH
    /// @param _token The address of the token to deposit
    /// @param _amount The amount of the token to deposit
    /// @param _referral The referral address
    /// @return mintedAmount the amount of eETH minted to the caller (= msg.sender)
    function depositWithERC20(
        address _token,
        uint256 _amount,
        address _referral
    ) external returns (uint256);
}
