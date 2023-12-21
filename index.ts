import { config } from "dotenv";
import { ThirdwebSDK, Abi, AbiSchema } from "@thirdweb-dev/sdk";
import { Goerli } from "@thirdweb-dev/chains";
import { utils, BytesLike } from "ethers";

import NFTAllowlistAbi from "./abi/NFTAllowlistAbi.json";
import ExtensionManagerAbi from "./abi/ExtensionManagerAbi.json";

config();

/**
 *  This script upgrades the ManagedAccountFactory contract to add the NFTAllowlist extension.
 *
 *  The NFTAllowlist extension overrides the NFT callback functions (`onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived`)
 *  to allow accounts to only receive NFTs allowlisted by the managed factory admin.
 *
 *  Upgrade steps:
 *    1. Disable the existing `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` from the `AccountExtension` default
 *       extension. This is required to avoid function conflicts with the new extension we are adding -- via calling `disableFunctionInExtension`.
 *
 *    2. Add the new `NFTAllowlist` extension to the account -- via calling `contract.extensions.add` method.
 */

interface ExtensionFunction {
  functionSelector: BytesLike;
  functionSignature: string;
}

const main = async () => {
  if (!process.env.WALLET_PRIVATE_KEY) {
    throw new Error("No private key found");
  }
  if (!process.env.THIRDWEB_SECRET_KEY) {
    throw new Error("No secret key found");
  }

  try {
    // Instantiate SDK
    const sdk = ThirdwebSDK.fromPrivateKey(
      process.env.WALLET_PRIVATE_KEY,
      Goerli,
      {
        secretKey: process.env.THIRDWEB_SECRET_KEY,
      }
    );

    // PASTE ADDRESS OF YOUR MANAGED ACCOUNT FACTORY HERE
    const managedFactoryAddress = "0x069c693687ce96636303e68b3507688cbcc9c426";
    console.log("Upgrading ManagedAccountFactory: ", managedFactoryAddress);

    // Get ManagedAccountFactory contract instance with the ExtensionManager ABI
    const managedFactoryContract = await sdk.getContractFromAbi(
      managedFactoryAddress,
      ExtensionManagerAbi
    );

    // Get `NFTAllowlist` functions (selector + signature)
    const extensionFunctions = generateExtensionFunctions(
      AbiSchema.parse(NFTAllowlistAbi)
    )
      .map((fn) => {
        return {
          functionSelector: fn.functionSelector as string,
          functionSignature: fn.functionSignature as string,
        };
      })
      .filter((fn) => !fn.functionSignature.includes("supportsInterface"));

    // Step 1. Disable the existing `onERC721Received`, `onERC1155Received` and `onERC1155BatchReceived` from the `AccountExtension` default extension.
    //         This is required to avoid conflicts with the new extension we are adding.

    for (const fn of extensionFunctions) {
      const toDisable =
        fn.functionSignature ===
          "onERC721Received(address,address,uint256,bytes)" ||
        fn.functionSignature ===
          "onERC1155Received(address,address,uint256,uint256,bytes)" ||
        fn.functionSignature ===
          "onERC1155BatchReceived(address,address,uint256[],uint256[],bytes)";

      if (toDisable) {
        console.log(`Disabling function ${fn.functionSignature.split("(")[0]}`);
        const tx = await managedFactoryContract.call(
          "disableFunctionInExtension",
          ["AccountExtension", fn.functionSelector]
        );
        console.log("Transaction: ", tx);
      }
    }

    // Step 2. Add the new `NFTAllowlist` extension to the account.
    console.log("Adding NFTAllowlist extension...");
    const tx = await managedFactoryContract.extensions.add({
      extension: {
        metadata: {
          name: "NFTAllowlist",
          metadataURI: "",
          implementation: "0xACD4a7C1D7C2d3b9FcF5441a923aA914229D56C1", // PASTE NFTALLOWLIST IMPLEMENTATION ADDRESS HERE
        },
        functions: extensionFunctions,
      },
      extensionAbi: NFTAllowlistAbi,
    });
    console.log("Transaction complete!", tx.transactionHash);

    console.log("Upgrade done!");
  } catch (e) {
    console.error("Something went wrong: ", e);
  }
};

main();

/////////////////////////// Utility functions ///////////////////////////

function generateExtensionFunctions(extensionAbi: Abi): ExtensionFunction[] {
  const extensionInterface = new utils.Interface(extensionAbi);
  const extensionFunctions: ExtensionFunction[] = [];
  // TODO - filter out common functions like _msgSender(), contractType(), etc.

  for (const fnFragment of Object.values(extensionInterface.functions)) {
    const fn = extensionInterface.getFunction(
      extensionInterface.getSighash(fnFragment)
    );
    if (fn.name.startsWith("_")) {
      continue;
    }
    extensionFunctions.push({
      functionSelector: extensionInterface.getSighash(fn),
      functionSignature: fn.name + getFunctionSignature(fn.inputs),
    });
  }
  return extensionFunctions;
}

function getFunctionSignature(fnInputs: any): string {
  return (
    "(" +
    fnInputs
      .map((i: any) => {
        return i.type === "tuple"
          ? getFunctionSignature(i.components)
          : i.type === "tuple[]"
          ? getFunctionSignature(i.components) + `[]`
          : i.type;
      })
      .join(",") +
    ")"
  );
}
