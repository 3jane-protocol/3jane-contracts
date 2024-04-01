// SPDX-License-Identifier: MIT
pragma solidity =0.8.4;

import {VaultLifecycleWithSwap} from "../libraries/VaultLifecycleWithSwap.sol";
import {Vault} from "../libraries/Vault.sol";

contract TestVaultLifecycle {
    Vault.VaultState public vaultState;

    function getNextFriday(uint256 currentExpiry)
        external
        pure
        returns (uint256 nextFriday)
    {
        return VaultLifecycleWithSwap.getNextFriday(currentExpiry);
    }

    function getNextExpiry(address currentOption)
        external
        view
        returns (uint256 nextExpiry)
    {
        return VaultLifecycleWithSwap.getNextExpiry(currentOption);
    }

    function balanceOf(address account) public view returns (uint256) {
        if (account == address(this)) {
            return 1 ether;
        }
        return 0;
    }

    function setVaultState(Vault.VaultState calldata newVaultState) public {
        vaultState.totalPending = newVaultState.totalPending;
        vaultState.queuedWithdrawShares = newVaultState.queuedWithdrawShares;
    }

    function getAuctionSettlementPrice(
        address gnosisEasyAuction,
        uint256 optionAuctionID
    ) external view returns (uint256) {
        return
            VaultLifecycleWithSwap.getAuctionSettlementPrice(
                gnosisEasyAuction,
                optionAuctionID
            );
    }
}
