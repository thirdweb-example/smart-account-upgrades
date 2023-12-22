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

## Core concepts: primer on dynamic contracts

The dynamic and managed account contracts both use the [dynamic contract pattern](https://github.com/thirdweb-dev/dynamic-contracts). Here’s a quick primer: An “upgradeable contract” is an implementation contract + a proxy contract.

![A proxy contract that forwards all calls to a single implementation contract](https://ipfs.io/ipfs/QmdzTiw5YuaMa1rjBtoyDuGHHRLdi9Afmh2Tu9Rjj1XuoA/proxy-with-single-impl.png)

The job of a proxy contract is to forward any calls it receives to the implementation contract via delegateCall. As a shorthand — a proxy contract stores state, and always asks an implementation contract how to mutate its state (upon receiving a call).

The dynamic contract pattern introduces a `Router` smart contract.

This router contract is a proxy, but instead of always delegateCall-ing the same implementation contract, a router delegateCalls particular implementation contracts (a.k.a “Extensions”) for the particular function calls it receives:

![A router contract that forwards calls to one of many implementation contracts based on the incoming calldata](https://ipfs.io/ipfs/Qmasd6DHrqMnkhifoapWAeWSs8eEJoFbzKJUpeEBacPAM7/router-many-impls.png)

A router stores a map from function selectors → to the implementation contract where the given function is implemented. “Upgrading a contract” now simply means updating what implementation contract a given function, or functions are mapped to.

![Upgrading a contract means updating what implementation a given function, or functions are mapped to](https://ipfs.io/ipfs/QmUWk4VrFsAQ8gSMvTKwPXptJiMjZdihzUNhRXky7VmgGz/router-upgrades.png)

## Authors

- [thirdweb](https://thirdweb.com)

## License

[Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)
