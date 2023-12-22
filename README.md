# Smart Account Upgrades

This repository contains examples of performing upgrades to [Managed](https://thirdweb.com/goerli/0x069c693687ce96636303e68b3507688cbcc9c426/events) and [Dynamic](https://thirdweb.com/thirdweb.eth/DynamicAccountFactory) smart accounts.

Both of these accounts are upgradeable and written in the [dynamic contract pattern](https://github.com/thirdweb-dev/dynamic-contracts). Read more about how these accounts work in this [deep dive post](https://blog.thirdweb.com/smart-contract-deep-dive-building-smart-wallets-for-individuals-and-teams/).

```bash
account-upgrade-examples
|
|-- src: "extension contracts used for upgrades to smart accounts"
|-- test: "tests illustrating an upgrade method and account functionality pre/post upgrade."
|-- scripts: "scripts you can run that perform the upgrades showcased in tests"
```

## Using This Repo

Clone this repoitory

```bash
git clone https://github.com/thirdweb-example/smart-account-upgrades.git
```

Install dependencies

```bash
yarn install
```

```bash
forge install
```

Deploy an extension contract to use for upgrades

```bash
npx thirdweb deploy --contract-name {name}
```

Perform an upgrade on a managed / dynamic account factory

```bash
ts-node scripts/{upgrade-script-name}.ts
```

## Examples

### NFTAllowlist

- Contract: [`src/NFTAllowlist.sol`](https://github.com/thirdweb-example/smart-account-upgrades/blob/main/src/NFTAllowlist.sol)
- Test: [`test/AccountUpgradeNFTAllowlist.t.sol`](https://github.com/thirdweb-example/smart-account-upgrades/blob/main/test/AccountUpgradedNFTAllowlist.t.sol)
- Upgrade script: [`scripts/accountUpgradeNFTAllowlist.ts`](https://github.com/thirdweb-example/smart-account-upgrades/blob/main/scripts/accountUpgradeNftAllowlist.ts)

This extension (`NFTAllowlist`) allows the account admin to configure an allowlist of NFTs that the account is allowed to receive.

On transferring an NFT to an account (smart contract) via the `safeTransferFrom` method, the NFT contracts calls the `onERC721Received` / `onERC1155Received` methods. This extension overrides these methods to check if the caller is included in the mentioned allowlist.

**Example use case:**
Allow accounts created on your app to only receive and own only in-app / approved NFTs.

**Upgrade steps:**

1. Disable `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` functions on the `AccountExtension` _default_ extension by calling `ManagedAccountFactory.disableFunctionInExtension`.

   This is to prevent conflicts when adding the `NFTAllowlist` extension where we define the updated NFT callback functions we want active in the smart account.

2. Add `NFTAllowlist` as an extension to the smart account by calling `ManagedAccount.addExtension`.

## Writing upgrades for your smart account

The Managed and Dynamic variety of smart accounts are upgradeable. Writing upgrades for these smart accounts comes down to understanding:

1. How upgrades work for dynamic contracts.
2. The difference in the upgrade-setup for managed and dynamic smart accounts.
3. Writing extension smart contracts that contain the logic to add to the account.
4. Using the dynamic contracts API to perform your the upgrade.

### [ I ] Primer on dynamic contracts

![A proxy contract that forwards all calls to a single implementation contract](https://ipfs.io/ipfs/QmdzTiw5YuaMa1rjBtoyDuGHHRLdi9Afmh2Tu9Rjj1XuoA/proxy-with-single-impl.png)

The job of a proxy contract is to forward any calls it receives to the implementation contract via delegateCall. As a shorthand — a proxy contract stores state, and always asks an implementation contract how to mutate its state (upon receiving a call).

The dynamic contract pattern introduces a `Router` smart contract.

This router contract is a proxy, but instead of always delegateCall-ing the same implementation contract, a router delegateCalls particular implementation contracts (a.k.a “Extensions”) for the particular function calls it receives:

![A router contract that forwards calls to one of many implementation contracts based on the incoming calldata](https://ipfs.io/ipfs/Qmasd6DHrqMnkhifoapWAeWSs8eEJoFbzKJUpeEBacPAM7/router-many-impls.png)

A router stores a map from function selectors → to the implementation contract where the given function is implemented. “Upgrading a contract” now simply means updating what implementation contract a given function, or functions are mapped to.

![Upgrading a contract means updating what implementation a given function, or functions are mapped to](https://ipfs.io/ipfs/QmUWk4VrFsAQ8gSMvTKwPXptJiMjZdihzUNhRXky7VmgGz/router-upgrades.png)

### [ II ] Difference between Managed and Dynamic account upgrades

**Dynamic accounts:**

The `DynamicAccount` account smart contract is written in the dynamic contract pattern and inherits the router contract mentioned previously. This means that for each individual `DynamicAccount` account created via a `DynamicAccountFactory` -- the admin of a given account decides what upgrades to make to their own individual account.

**Managed Accounts:**

Like the dynamic accounts, the `ManagedAccount` account contract is also written in the dynamic contract pattern.

The main difference between these two types of account contracts is that each individual dynamic account stores its own map of function selectors → to extension contracts, whereas all managed account contracts listen into the same map stored by their parent ManagedAccountFactory factory contracts.

![Managed versus dynamic account routers](https://ipfs.io/ipfs/QmUeHD3FEXAexJL5WiZ9jaBZ7UH7SWmv8sJoQEhisupSZb/smart-wallet-diag-7.png)

This is why managed accounts are called “managed”. An admin of the managed account factory contracts is responsible for managing the capabilities of the factory’s children managed accounts.

When an admin of a managed account factory updates the function selector → extension map in the factory contract (through), this upgrade is instantly applied to all of the factory’s children account contracts.

### [ III ] Writing extension smart contracts

For boilerplate code of an extension smart contract, run the following in your contracts project:

```bash
thirdweb create --extension
```

An `Extension` contract is written like any other smart contract, except that its state must be defined using a `struct` within a `library` and at a well defined storage location. This storage technique is known as [storage structs](https://mirror.xyz/horsefacts.eth/EPB4o-eyDl0N8gu0gEz1uw7BTITheaZUqIAOEK1m-jE).

**Example:** `NFTAllowlistStorage` defines the storage layout for the `NFTAllowlist` contract.

```solidity
// SPDX-License-Identifier: Apache 2.0
pragma solidity ^0.8.0;

/// @author thirdweb

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
```

Each `Extension` of a router must occupy a unique, unused storage location. This is important to ensure that state updates defined in one `Extension` doesn't conflict with the state updates defined in another `Extension`, leading to corrupted state.

Find an in-depth explanation of extensions in [this post](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#getting-started).

### [ IV ] Performing an upgrade

The `ManagedAccountFactory` and `DynamicAccount` contracts implement the [ExtensionManager API](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#extensionmanager). This API exposes the following methdods for performing upgrades:

- [addExtension](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#addextension): add a new extension to the account. All calls to functions specified in this extension will be routed to the implementation provided along with this extension.
- [replaceExtension](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#replaceextension): replace an existing extension of the account. This replaces all of the extension's data stored on the contract with the provided input -- this includes all functions and the implementation associated with the extension.
- [removeExtension](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#removeextension): remove an existing extension of the account. This deletes the extension namespace and all extension data from the contract.
- [disableFunctionInExtension](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#disablefunctioninextension): deletes the map of a specific function to the given extension's implementation.
- [enableFunctionInExtension](https://github.com/thirdweb-dev/dynamic-contracts?tab=readme-ov-file#enablefunctioninextension): maps a specific extension to the given extension's implementation.

All examples in this repo use a combination of these functions to perform an upgrade.

## Authors

- [thirdweb](https://thirdweb.com)

## License

[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)
