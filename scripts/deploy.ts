import {
  Keypair,
  rpc,
  TransactionBuilder,
  Operation,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import * as fs from "fs";

const RPC_URL = process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";

async function deployContract(
  server: Server,
  source: Keypair,
  wasmBuffer: Buffer
): Promise<string> {
  const account = await server.getAccount(source.publicKey());

  const uploadTx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.uploadContractWasm({ wasm: wasmBuffer })
    )
    .setTimeout(30)
    .build();

  uploadTx.sign(source);
  const uploadResult = await server.sendTransaction(uploadTx);

  let wasmHash = "";
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const resp = await server.getTransaction(uploadResult.hash);
    if (resp.status === "SUCCESS") {
      wasmHash = (resp as any).returnValue?.bytes() || "";
      break;
    }
  }

  if (!wasmHash) throw new Error("WASM upload failed");

  const createTx = new TransactionBuilder(
    await server.getAccount(source.publicKey()),
    { fee: "100", networkPassphrase: NETWORK_PASSPHRASE }
  )
    .addOperation(
      Operation.createCustomContract({
        wasmHash: Buffer.from(wasmHash, "hex"),
        address: source.publicKey(),
      })
    )
    .setTimeout(30)
    .build();

  createTx.sign(source);
  const createResult = await server.sendTransaction(createTx);

  let contractId = "";
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const resp = await server.getTransaction(createResult.hash);
    if (resp.status === "SUCCESS") {
      contractId = (resp as any).contractId || "";
      break;
    }
  }

  if (!contractId) throw new Error("Contract creation failed");
  return contractId;
}

async function invokeContract(
  server: Server,
  source: Keypair,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[]
): Promise<string> {
  const account = await server.getAccount(source.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: contractId,
        function: functionName,
        args,
      })
    )
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(source);
  const result = await server.sendTransaction(prepared);
  return result.hash;
}

async function main() {
  const secretKey = process.env.STELLAR_SECRET_KEY;
  if (!secretKey) {
    console.error("STELLAR_SECRET_KEY is required");
    process.exit(1);
  }

  const source = Keypair.fromSecret(secretKey);
  const server = new rpc.Server(RPC_URL);

  console.log("Deploying Flipper Protocol contracts to Stellar Testnet...");
  console.log(`  Deployer: ${source.publicKey()}`);

  console.log("\n1. Deploying FlipperRegistry...");
  const registryWasm = fs.readFileSync("contracts/flipper-registry/target/wasm32-unknown-unknown/release/flipper_registry.wasm");
  const registryId = await deployContract(server, source, registryWasm);
  console.log(`   FlipperRegistry deployed to: ${registryId}`);

  await invokeContract(server, source, registryId, "__constructor", [
    nativeToScVal(1000000, { type: "i128" }),
    nativeToScVal(10000, { type: "u64" }),
    nativeToScVal(source.publicKey(), { type: "address" }),
  ]);

  console.log("\n2. Deploying FlipperVault...");
  const vaultWasm = fs.readFileSync("contracts/flipper-vault/target/wasm32-unknown-unknown/release/flipper_vault.wasm");
  const vaultId = await deployContract(server, source, vaultWasm);
  console.log(`   FlipperVault deployed to: ${vaultId}`);

  const nativeToken = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA";
  await invokeContract(server, source, vaultId, "__constructor", [
    nativeToScVal(registryId, { type: "address" }),
    nativeToScVal(50, { type: "u64" }),
    nativeToScVal(1000000, { type: "i128" }),
    nativeToScVal(nativeToken, { type: "address" }),
    nativeToScVal(source.publicKey(), { type: "address" }),
  ]);

  console.log("\n3. Deploying DecisionLogger...");
  const loggerWasm = fs.readFileSync("contracts/decision-logger/target/wasm32-unknown-unknown/release/decision_logger.wasm");
  const loggerId = await deployContract(server, source, loggerWasm);
  console.log(`   DecisionLogger deployed to: ${loggerId}`);

  await invokeContract(server, source, loggerId, "__constructor", [
    nativeToScVal(source.publicKey(), { type: "address" }),
  ]);

  console.log("\n4. Deploying X402Payment...");
  const x402Wasm = fs.readFileSync("contracts/target/wasm32-unknown-unknown/release/x402_payment.wasm");
  const x402Id = await deployContract(server, source, x402Wasm);
  console.log(`   X402Payment deployed to: ${x402Id}`);

  const usdcContract = "CCW67TSZV3NSI4FS7FXTA6D3KQAJ5VW6UJRV3GSB7Q6Y2I3AIA7F6GCH";
  await invokeContract(server, source, x402Id, "__constructor", [
    nativeToScVal(source.publicKey(), { type: "address" }),
    nativeToScVal(usdcContract, { type: "address" }),
    nativeToScVal(50, { type: "u64" }),
    nativeToScVal(source.publicKey(), { type: "address" }),
  ]);

  console.log("\n5. Configuring permissions...");
  await invokeContract(server, source, registryId, "set_vault_authorization", [
    nativeToScVal(vaultId, { type: "address" }),
    nativeToScVal(true, { type: "bool" }),
  ]);
  console.log("   ✓ Vault authorized in Registry");

  await invokeContract(server, source, vaultId, "set_operator_authorization", [
    nativeToScVal(source.publicKey(), { type: "address" }),
    nativeToScVal(true, { type: "bool" }),
  ]);
  console.log("   ✓ Deployer authorized as operator in Vault");

  await invokeContract(server, source, loggerId, "set_logger_authorization", [
    nativeToScVal(source.publicKey(), { type: "address" }),
    nativeToScVal(true, { type: "bool" }),
  ]);
  console.log("   ✓ Deployer authorized as logger");

  await invokeContract(server, source, x402Id, "set_verifier_authorization", [
    nativeToScVal(source.publicKey(), { type: "address" }),
    nativeToScVal(true, { type: "bool" }),
  ]);
  console.log("   ✓ Deployer authorized as x402 verifier");

  console.log("\n" + "═".repeat(60));
  console.log("  DEPLOYMENT COMPLETE — Stellar Testnet");
  console.log("═".repeat(60));
  console.log(`  FlipperRegistry:  ${registryId}`);
  console.log(`  FlipperVault:     ${vaultId}`);
  console.log(`  DecisionLogger:   ${loggerId}`);
  console.log(`  X402Payment:      ${x402Id}`);
  console.log("═".repeat(60));

  const deploymentData = {
    network: "stellar-testnet",
    passphrase: NETWORK_PASSPHRASE,
    deployedAt: new Date().toISOString(),
    contracts: { FlipperRegistry: registryId, FlipperVault: vaultId, DecisionLogger: loggerId, X402Payment: x402Id },
  };

  fs.writeFileSync("deployment.json", JSON.stringify(deploymentData, null, 2));
  console.log("\n  Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
