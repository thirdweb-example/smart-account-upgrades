import { config } from "dotenv";
import { ThirdwebSDK, Abi, AbiSchema } from "@thirdweb-dev/sdk";
import { utils, BytesLike } from "ethers";

import NFTAllowlistAbi from "./abi/NFTAllowlistAbi.json";
import ExtensionManagerAbi from "./abi/ExtensionManagerAbi.json";

config();

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
      "mumbai",
      {
        secretKey: process.env.THIRDWEB_SECRET_KEY,
      }
    );

    // PASTE ADDRESS OF YOUR MANAGED ACCOUNT FACTORY HERE
    const managedFactoryAddress = "";
    console.log("Upgrading ManagedAccountFactory: ", managedFactoryAddress);

    // Get ManagedAccountFactory contract instance with the ExtensionManager ABI
    const managedFactoryContract = await sdk.getContractFromAbi(
      managedFactoryAddress,
      ExtensionManagerAbi
    );

    // Get `NFTAllowlist` functions (selector + signature)
    const extensionFunctions = generateExtensionFunctions(
      AbiSchema.parse(NFTAllowlistAbi)
    ).map((fn) => {
      return {
        functionSelector: fn.functionSelector as string,
        functionSignature: fn.functionSignature as string,
      };
    });

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
        console.log("Transaction: ", tx.hash);
        await tx.wait();
        console.log("Transaction complete!");
      }
    }

    // Step 2. Add the new `NFTAllowlist` extension to the account.
    console.log("Adding NFTAllowlist extension...");
    const tx = await managedFactoryContract.extensions.add({
      extension: {
        metadata: {
          name: "NFTAllowlist",
          metadataURI: "",
          implementation: "", // PASTE NFTALLOWLIST IMPLEMENTATION ADDRESS HERE
        },
        functions: extensionFunctions,
      },
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
