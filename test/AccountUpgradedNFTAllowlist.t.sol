// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.0;

/// @author thirdweb

/**
 *  This is a test case illustrating an upgrade on `ManagedAccount`.
 *
 *  Example: Upgrade `ManagedAccount` with `NFTAllowlist` to only permit accounts to receive
 *           allowlisted NFTs.
 *
 *  Use case: Allow accounts created on your app to only receive and own only in-app NFTs.
 */

// Test util
import {Test} from "forge-std/Test.sol";
import { IExtension } from "@thirdweb-dev/dynamic-contracts/src/interface/IExtension.sol";
import { BaseRouter } from "@thirdweb-dev/dynamic-contracts/src/presets/BaseRouter.sol";
import { EntryPoint, IEntryPoint } from "@thirdweb-dev/contracts/prebuilts/account/utils/Entrypoint.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { ERC1155 } from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";

// Target test contracts
import { NFTAllowlist } from "src/NFTAllowlist.sol";

import { ManagedAccountFactory } from "@thirdweb-dev/contracts/prebuilts/account/managed/ManagedAccountFactory.sol";
import { ManagedAccount } from "@thirdweb-dev/contracts/prebuilts/account/managed/ManagedAccount.sol";
import { AccountExtension } from "@thirdweb-dev/contracts/prebuilts/account/utils/AccountExtension.sol";

contract MockERC721NFT is ERC721 {

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function mint(address to, uint256 tokenId) public {
        _safeMint(to, tokenId);
    }
}

contract MockERC1155NFT is ERC1155 {

    constructor(string memory baseURI) ERC1155(baseURI) {}

    function mint(address to, uint256 tokenId, uint256 amount) public {
        _mint(to, tokenId, amount, "");
    }
}

contract AccountUpgradeNFTAllowlistTest is Test, IExtension {
    
    address internal accountAdmin = address(0x1212);
    address internal factoryAdmin = address(0x4545);
    address internal nonAdmin = address(0x2323);

    ManagedAccountFactory internal accountFactory;
    ManagedAccount internal account;
    
    MockERC721NFT internal nft;
    MockERC721NFT internal nftAllowlisted;
    
    MockERC1155NFT internal edition;
    MockERC1155NFT internal editionAllowlisted;

    function setUp() public {

        // Mock NFT contracts
        nft = new MockERC721NFT("ERC-721 Not Allowlisted", "NFTNA");
        nftAllowlisted = new MockERC721NFT("ERC-721 Allowlisted", "NFTA");
        
        edition = new MockERC1155NFT("baseURI/notallowlisted/");
        editionAllowlisted = new MockERC1155NFT("baseURI/allowlisted/");

        // Setup default extensions
        string[] memory inputs = new string[](2);

        inputs[0] = "node";
        inputs[1] = "test/scripts/getAccountExtensionFunctions.ts";

        bytes memory result = vm.ffi(inputs);
        
        bytes4[] memory fnSelectors;
        string[] memory fnSignatures;
        (fnSelectors, fnSignatures) = abi.decode(result, (bytes4[], string[]));
    
        assertEq(fnSelectors.length, fnSignatures.length);
        assertTrue(fnSelectors.length > 0);

        // Setting up default extension.
        Extension[] memory defaultExtensions = new Extension[](1);
        Extension memory defaultExt;

        defaultExt.metadata = ExtensionMetadata({
            name: "AccountExtension",
            metadataURI: "ipfs://AccountExtension",
            implementation: address(new AccountExtension())
        });

        defaultExt.functions = new IExtension.ExtensionFunction[](fnSelectors.length);
        for(uint256 i = 0; i < fnSelectors.length; i++) {
            defaultExt.functions[i] = IExtension.ExtensionFunction({
                functionSelector: fnSelectors[i],
                functionSignature: fnSignatures[i]
            });
        }

        defaultExtensions[0] = defaultExt;

        // Deploy ERC-4337 `EntryPoint` contract for set setup.
        EntryPoint entrypoint = new EntryPoint();

        // Deploy `ManagedAccountFactory`.
        vm.prank(factoryAdmin);
        accountFactory = new ManagedAccountFactory(
            factoryAdmin,
            IEntryPoint(payable(address(entrypoint))),
            defaultExtensions
        );

        // Deploy `ManagedAccount` contract.
        vm.prank(accountAdmin);
        account = ManagedAccount(payable(accountFactory.createAccount(accountAdmin, "")));
    }

    function testMintPreUpgrade() public {
        uint256 tokenId = 0;

        vm.expectRevert("ERC721: invalid token ID");
        nft.ownerOf(tokenId);
        assertEq(edition.balanceOf(address(account), tokenId), 0);

        // Mint tokens
        nft.mint(address(account), tokenId);
        edition.mint(address(account), tokenId, 1);

        assertEq(nft.ownerOf(tokenId), address(account));
        assertEq(edition.balanceOf(address(account), tokenId), 1);
    }

    function testMintPostUpgrade() public {

        uint256 tokenId = 0;
        
        // Disable `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` on `AccountExtension` extension.
        vm.startPrank(factoryAdmin);
        
        accountFactory.disableFunctionInExtension("AccountExtension", NFTAllowlist.onERC721Received.selector);
        accountFactory.disableFunctionInExtension("AccountExtension", NFTAllowlist.onERC1155BatchReceived.selector);
        accountFactory.disableFunctionInExtension("AccountExtension", NFTAllowlist.onERC1155Received.selector);

        vm.stopPrank();

        // Verify that `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` are disabled.
        vm.expectRevert("Router: function does not exist.");
        nft.mint(address(account), tokenId);

        vm.expectRevert("Router: function does not exist.");
        edition.mint(address(account), tokenId, 1);

        // Add `NFTAllowlist` extension to `ManagedAccount` contract.
        Extension memory extension;

        extension.metadata = ExtensionMetadata({
            name: "NFTAllowlist",
            metadataURI: "ipfs://NFTAllowlist",
            implementation: address(new NFTAllowlist())
        });

        extension.functions = new IExtension.ExtensionFunction[](5);
        extension.functions[0] = IExtension.ExtensionFunction({
            functionSelector: NFTAllowlist.onERC721Received.selector,
            functionSignature: "onERC721Received(address,address,uint256,bytes)"
        });
        extension.functions[1] = IExtension.ExtensionFunction({
            functionSelector: NFTAllowlist.onERC1155Received.selector,
            functionSignature: "onERC1155Received(address,address,uint256,uint256,bytes)"
        });
        extension.functions[2] = IExtension.ExtensionFunction({
            functionSelector: NFTAllowlist.onERC1155BatchReceived.selector,
            functionSignature: "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)"
        });
        extension.functions[3] = IExtension.ExtensionFunction({
            functionSelector: NFTAllowlist.isAllowlisted.selector,
            functionSignature: "isAllowlisted(address)"
        });
        extension.functions[4] = IExtension.ExtensionFunction({
            functionSelector: NFTAllowlist.allowlist.selector,
            functionSignature: "allowlist(address,bool)"
        });

        vm.prank(factoryAdmin);
        accountFactory.addExtension(extension);

        // Admin allowlists certain NFTs
        vm.startPrank(accountAdmin);
        NFTAllowlist(address(account)).allowlist(address(nftAllowlisted), true);
        NFTAllowlist(address(account)).allowlist(address(editionAllowlisted), true);
        vm.stopPrank();

        // Fails: attempt to mint non-allowlisted tokens
        assertFalse(NFTAllowlist(address(account)).isAllowlisted(address(nft)));
        vm.expectRevert(abi.encodeWithSelector(NFTAllowlist.NotAllowlisted.selector, address(nft)));
        nft.mint(address(account), tokenId);

        assertFalse(NFTAllowlist(address(account)).isAllowlisted(address(edition)));
        vm.expectRevert("ERC1155: transfer to non ERC1155Receiver implementer");
        edition.mint(address(account), tokenId, 1);

        // Success: mint allowlisted tokens
        assertTrue(NFTAllowlist(address(account)).isAllowlisted(address(nftAllowlisted)));
        nftAllowlisted.mint(address(account), tokenId);
        assertEq(nftAllowlisted.ownerOf(tokenId), address(account));

        assertTrue(NFTAllowlist(address(account)).isAllowlisted(address(editionAllowlisted)));
        editionAllowlisted.mint(address(account), tokenId, 1);
        assertEq(editionAllowlisted.balanceOf(address(account), tokenId), 1);
    }
}