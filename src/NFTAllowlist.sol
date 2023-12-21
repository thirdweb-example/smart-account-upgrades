// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.0;

/// @author thirdweb

/**
 *  This is an example of an extension that can be used with a Managed or Dynamic account. 
 *
 *  - This extension (`NFTAllowlist`) allows the account admin to configure an allowlist of NFTs that the account is
 *    allowed to receive.
 *
 *  - On transferring an NFT to an account (smart contract) via the `safeTransferFrom` method, the NFT contracts calls
 *    the `onERC721Received` / `onERC1155Received` methods. This extension overrides these methods to check if the caller
 *    is included in the mentioned allowlist.
 */

import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "./OnlyAccountAdmin.sol";

library NFTAllowlistStorage {
    /// @custom:storage-location erc7201:nft.allowlist.storage
    /// @dev keccak256(abi.encode(uint256(keccak256("nft.allowlist.storage")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 internal constant NFT_ALLOWLIST_STORAGE_POSITION =  keccak256(abi.encode(uint256(keccak256("nft.allowlist.storage")) - 1)) & ~bytes32(uint256(0xff));

    struct Data {
        mapping(address => bool) allowlisted;
    }

    function data() internal pure returns (Data storage s) {
        bytes32 loc = NFT_ALLOWLIST_STORAGE_POSITION;
        assembly {
            s.slot := loc
        }
    }
}

contract NFTAllowlist is OnlyAccountAdmin, ERC721Holder, ERC1155Holder {

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when an NFT being transferred into the contract is not in allowlist.
    error NotAllowlisted(address nftContract);

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted when an NFT contract is added or removed from the allowlist.
    event AllowlistUpdated(address indexed nftContract, bool toAllowlist);

    /*//////////////////////////////////////////////////////////////
                            ALLOWLIST FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Checks whether an NFT contract is in allowlist.
    function isAllowlisted(address nftContract) external view returns (bool) {
        return NFTAllowlistStorage.data().allowlisted[nftContract];
    }

    /// @notice Adds or removes an NFT contract from the allowlist.
    function allowlist(address nftContract, bool _toAllowlist) external {
        // Throw error is caller is not account admin.
        _onlyAdmin();

        NFTAllowlistStorage.data().allowlisted[nftContract] = _toAllowlist;
        emit AllowlistUpdated(nftContract, _toAllowlist);
    }

    /*//////////////////////////////////////////////////////////////
                        NFT CALLBACK FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Checks whether NFT being transferred into contract is in allowlist.
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes memory data
    ) public virtual override returns (bytes4) {

        if(!NFTAllowlistStorage.data().allowlisted[msg.sender]) {
            revert NotAllowlisted(msg.sender);
        }
        return super.onERC721Received(operator, from, tokenId, data);
    }

    /// @notice Checks whether NFT being transferred into contract is in allowlist.
    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes memory data
    ) public virtual override returns (bytes4) {
            
        if(!NFTAllowlistStorage.data().allowlisted[msg.sender]) {
            revert NotAllowlisted(msg.sender);
        }
        return super.onERC1155Received(operator, from, id, value, data);
    }

    /// @notice Checks whether NFT being transferred into contract is in allowlist.
    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] memory ids,
        uint256[] memory values,
        bytes memory data
    ) public virtual override returns (bytes4) {
        if(!NFTAllowlistStorage.data().allowlisted[msg.sender]) {
            revert NotAllowlisted(msg.sender);
        }
        return super.onERC1155BatchReceived(operator, from, ids, values, data);
    }
}