// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {ISwap} from "../interfaces/ISwap.sol";

abstract contract RibbonThetaVaultStorageV1 {
    // Logic contract used to price options
    address public optionsPremiumPricer;
    // Logic contract used to select strike prices
    address public strikeSelection;
    // Current oToken premium
    uint256 public currentOtokenPremium;
    // Last round id at which the strike was manually overridden
    uint16 public lastStrikeOverrideRound;
    // Price last overridden strike set to
    uint256 public overriddenStrikePrice;
    // Auction id of current option
    uint256 public optionAuctionID;

    // Amount locked for scheduled withdrawals last week;
    uint256 public lastQueuedWithdrawAmount;
    // OptionsPurchaseQueue contract for selling options
    address public optionsPurchaseQueue;
    // Queued withdraw shares for the current round
    uint256 public currentQueuedWithdrawShares;
}

abstract contract RibbonThetaVaultStorageV2 {
    // Settled bids from previous round
    ISwap.Bid[] internal settledBids;
}

// We are following Compound's method of upgrading new contract implementations
// When we need to add new storage variables, we create a new version of RibbonThetaVaultStorage
// e.g. RibbonThetaVaultStorage<versionNumber>, so finally it would look like
// contract RibbonThetaVaultStorage is RibbonThetaVaultStorageV1, RibbonThetaVaultStorageV2
abstract contract RibbonThetaVaultStorage is RibbonThetaVaultStorageV1, RibbonThetaVaultStorageV2 {

}
