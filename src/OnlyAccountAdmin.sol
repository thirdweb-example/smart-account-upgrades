// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.0;

/// @author thirdweb

import { AccountPermissionsStorage } from "@thirdweb-dev/contracts/extension/upgradeable/AccountPermissions.sol";

contract OnlyAccountAdmin {

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @dev Emitted when the caller of an admin-gated function is not an admin.
    error NotAdmin(address account);

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Throws if the caller is not an admin.
    function _onlyAdmin() internal virtual {
        if(!_accountPermissionsStorage().isAdmin[msg.sender]) {
            revert NotAdmin(msg.sender);
        }
    }

    /// @dev Returns the AccountPermissions storage.
    function _accountPermissionsStorage() internal pure returns (AccountPermissionsStorage.Data storage data) {
        data = AccountPermissionsStorage.data();
    }
}