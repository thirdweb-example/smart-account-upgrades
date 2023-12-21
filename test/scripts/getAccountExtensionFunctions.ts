const { Abi, AbiSchema } = require("@thirdweb-dev/sdk");
const { utils } = require("ethers");
const AccountExtensionAbi = require("./AccountExtension.json");
const process = require("process");

function getFunctionSignature(fnInputs) {
  return (
    "(" +
    fnInputs
      .map((i) => {
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

function generateExtensionFunctions(extensionAbi) {
  const extensionInterface = new utils.Interface(extensionAbi);
  const extensionFunctions = [];
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

const accountExtensionFunctions = generateExtensionFunctions(
  AbiSchema.parse(AccountExtensionAbi)
);

// Add `receive()` function
accountExtensionFunctions.push({
  functionSelector: "0x00000000",
  functionSignature: "receive()",
});

const selectors = accountExtensionFunctions.map((fn) => fn.functionSelector);
const signatures = accountExtensionFunctions.map((fn) => fn.functionSignature);

process.stdout.write(
  utils.defaultAbiCoder.encode(
    ["bytes4[]", "string[]"],
    [selectors, signatures]
  )
);
