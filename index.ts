// import { config } from "dotenv";
// import { ThirdwebSDK } from "@thirdweb-dev/sdk";
// import { readFileSync } from "fs";

// config();

import { Abi, AbiSchema } from "@thirdweb-dev/sdk";
import { utils, BytesLike, ContractInterface } from "ethers";

import AccountExtensionAbi from "./test/scripts/AccountExtension.json";

interface ExtensionFunction {
  functionSelector: BytesLike;
  functionSignature: string;
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

const main = async () => {
  console.log("Hello world");
  const accountExtensionFunctions = generateExtensionFunctions(
    AbiSchema.parse(AccountExtensionAbi)
  );

  accountExtensionFunctions.push({
    functionSelector: "0x00000000",
    functionSignature: "receive()",
  });

  accountExtensionFunctions.forEach((fn, i) => {
    if (fn.functionSignature === "receive()") {
      console.log("FOUND RECEIVE");
    }

    console.log(`Function ${i}:`);
    console.log(fn.functionSelector);
    console.log(fn.functionSignature);
  });
  // if (!process.env.WALLET_PRIVATE_KEY) {
  //   throw new Error("No private key found");
  // }
  // try {
  //   const sdk = ThirdwebSDK.fromPrivateKey(
  //     process.env.WALLET_PRIVATE_KEY,
  //     "mumbai",
  //     {
  //       secretKey: process.env.THIRDWEB_SECRET_KEY,
  //     }
  //   );
  //   const contractAddress = await sdk.deployer.deployNFTDrop({
  //     name: "My Drop",
  //     primary_sale_recipient: "0x39Ab29fAfb5ad19e96CFB1E1c492083492DB89d4",
  //   });
  //   console.log("Contract address: ", contractAddress);
  //   const contract = await sdk.getContract(contractAddress, "nft-drop");
  //   const metadatas = [
  //     {
  //       name: "Blue Star",
  //       description: "A blue star NFT",
  //       image: readFileSync("assets/blue-star.png"),
  //     },
  //     {
  //       name: "Red Star",
  //       description: "A red star NFT",
  //       image: readFileSync("assets/red-star.png"),
  //     },
  //     {
  //       name: "Yellow Star",
  //       description: "A yellow star NFT",
  //       image: readFileSync("assets/yellow-star.png"),
  //     },
  //   ];
  //   await contract.createBatch(metadatas);
  //   console.log("Created batch successfully!");
  // } catch (e) {
  //   console.error("Something went wrong: ", e);
  // }
};

main();
