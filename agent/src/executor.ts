import {
  Keypair,
  rpc,
  TransactionBuilder,
  Operation,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { RiskLevel, RiskSnapshot, SuggestedAction, ThreatAssessment } from "./analyzer";

export interface ExecutorConfig {
  secretKey: string;
  vaultContractId: string;
  registryContractId: string;
  loggerContractId: string;
  agentId: number;
  dryRun: boolean;
  rpcUrl: string;
  networkPassphrase: string;
}

const ACTION_TYPE_MAP: Record<string, number> = {
  [SuggestedAction.EMERGENCY_WITHDRAW]: 0,
  [SuggestedAction.REBALANCE]: 1,
  [SuggestedAction.ALERT]: 2,
  [SuggestedAction.STOP_LOSS]: 3,
  [SuggestedAction.TAKE_PROFIT]: 4,
};

const DECISION_TYPE_MAP: Record<string, number> = {
  "RiskAssessment": 0,
  "ThreatDetected": 1,
  "ProtectionTriggered": 2,
  "AllClear": 3,
  "MarketAnalysis": 4,
  "PositionReview": 5,
};

export class OnChainExecutor {
  private keypair: Keypair;
  private server: rpc.Server;
  private config: ExecutorConfig;
  private executionLog: ExecutionRecord[] = [];

  constructor(config: ExecutorConfig) {
    this.config = config;
    this.keypair = Keypair.fromSecret(config.secretKey);
    this.server = new rpc.Server(config.rpcUrl);

    console.log("[Flipper Executor] Initialized (Stellar)");
    console.log(`  Agent ID: ${config.agentId}`);
    console.log(`  Operator: ${this.keypair.publicKey()}`);
    console.log(`  Dry Run: ${config.dryRun}`);
  }

  async logDecision(
    threat: ThreatAssessment,
    targetUser: string,
    reasoningHash: string
  ): Promise<string | null> {
    const decisionType = threat.threatDetected
      ? (threat.suggestedAction !== SuggestedAction.NONE &&
         threat.suggestedAction !== SuggestedAction.MONITOR &&
         threat.suggestedAction !== SuggestedAction.ALERT
          ? DECISION_TYPE_MAP["ProtectionTriggered"]
          : DECISION_TYPE_MAP["ThreatDetected"])
      : DECISION_TYPE_MAP["AllClear"];

    const riskLevel = threat.severity;
    const confidence = Math.round(threat.confidence * 100);

    console.log(`[Flipper Executor] Logging decision: type=${decisionType} risk=${riskLevel}`);

    if (this.config.dryRun) {
      console.log("[Flipper Executor] DRY RUN — skipping on-chain log");
      this.recordExecution("logDecision", true, "dry-run", targetUser);
      return "dry-run-tx";
    }

    try {
      const account = await this.server.getAccount(this.keypair.publicKey());

      const analysisHashBytes = Buffer.from(reasoningHash.replace("0x", ""), "hex");
      const analysisHashScVal = nativeToScVal(analysisHashBytes, { type: "bytes" });
      const dataHashScVal = nativeToScVal(Buffer.alloc(32, 0), { type: "bytes" });

      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: this.config.loggerContractId,
            function: "log_decision",
            args: [
              nativeToScVal(this.keypair.publicKey(), { type: "address" }),
              nativeToScVal(this.config.agentId, { type: "u64" }),
              nativeToScVal(targetUser, { type: "address" }),
              nativeToScVal(decisionType, { type: "u32" }),
              nativeToScVal(riskLevel, { type: "u32" }),
              nativeToScVal(confidence, { type: "u64" }),
              analysisHashScVal,
              dataHashScVal,
              nativeToScVal(false, { type: "bool" }),
              nativeToScVal(0, { type: "u64" }),
            ],
          })
        )
        .setTimeout(30)
        .build();

      const simResult = await this.server.simulateTransaction(tx);
      const prepared = await this.server.prepareTransaction(tx);
      prepared.sign(this.keypair);

      const result = await this.server.sendTransaction(prepared);
      console.log(`[Flipper Executor] Decision logged: ${result.hash}`);
      this.recordExecution("logDecision", true, result.hash, targetUser);
      return result.hash;
    } catch (error: any) {
      console.error("[Flipper Executor] Failed to log decision:", error.message);
      this.recordExecution("logDecision", false, error.message, targetUser);
      return null;
    }
  }

  async logRiskSnapshot(snapshot: RiskSnapshot): Promise<string | null> {
    console.log(`[Flipper Executor] Logging risk snapshot: LIQ=${snapshot.liquidationRisk} VOL=${snapshot.volatilityRisk}`);

    if (this.config.dryRun) {
      console.log("[Flipper Executor] DRY RUN — skipping risk snapshot");
      return "dry-run-tx";
    }

    try {
      const account = await this.server.getAccount(this.keypair.publicKey());
      const detailsHash = nativeToScVal(Buffer.alloc(32, 0), { type: "bytes" });

      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: this.config.loggerContractId,
            function: "update_risk_snapshot",
            args: [
              nativeToScVal(this.keypair.publicKey(), { type: "address" }),
              nativeToScVal(this.keypair.publicKey(), { type: "address" }),
              nativeToScVal(snapshot.riskLevel, { type: "u32" }),
              nativeToScVal(snapshot.liquidationRisk, { type: "u64" }),
              nativeToScVal(snapshot.volatilityRisk, { type: "u64" }),
              nativeToScVal(snapshot.protocolRisk, { type: "u64" }),
              nativeToScVal(snapshot.smartContractRisk, { type: "u64" }),
              detailsHash,
            ],
          })
        )
        .setTimeout(30)
        .build();

      const prepared = await this.server.prepareTransaction(tx);
      prepared.sign(this.keypair);

      const result = await this.server.sendTransaction(prepared);
      console.log(`[Flipper Executor] Risk snapshot logged: ${result.hash}`);
      return result.hash;
    } catch (error: any) {
      console.error("[Flipper Executor] Failed to log risk snapshot:", error.message);
      return null;
    }
  }

  async executeProtection(
    userAddress: string,
    action: SuggestedAction,
    value: bigint,
    _reason: string
  ): Promise<string | null> {
    const actionType = ACTION_TYPE_MAP[action];
    if (actionType === undefined) {
      console.log(`[Flipper Executor] Action ${action} not executable on-chain`);
      return null;
    }

    console.log(`[Flipper Executor] Executing protection: ${action} for ${userAddress}`);

    if (this.config.dryRun) {
      console.log("[Flipper Executor] DRY RUN — skipping protection execution");
      this.recordExecution("protection", true, "dry-run", userAddress);
      return "dry-run-tx";
    }

    try {
      const account = await this.server.getAccount(this.keypair.publicKey());
      const reasonHash = nativeToScVal(Buffer.alloc(32, 0), { type: "bytes" });

      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: this.config.networkPassphrase,
      })
        .addOperation(
          Operation.invokeContractFunction({
            contract: this.config.vaultContractId,
            function: "execute_protection",
            args: [
              nativeToScVal(this.keypair.publicKey(), { type: "address" }),
              nativeToScVal(userAddress, { type: "address" }),
              nativeToScVal(actionType, { type: "u32" }),
              nativeToScVal(value, { type: "i128" }),
              reasonHash,
            ],
          })
        )
        .setTimeout(30)
        .build();

      const prepared = await this.server.prepareTransaction(tx);
      prepared.sign(this.keypair);

      const result = await this.server.sendTransaction(prepared);
      console.log(`[Flipper Executor] Protection executed: ${result.hash}`);
      this.recordExecution("protection", true, result.hash, userAddress);
      return result.hash;
    } catch (error: any) {
      console.error("[Flipper Executor] Protection failed:", error.message);
      this.recordExecution("protection", false, error.message, userAddress);
      return null;
    }
  }

  private recordExecution(type: string, success: boolean, txHash: string, target: string): void {
    this.executionLog.push({ type, success, txHash, target, timestamp: Date.now() });
  }

  getExecutionLog(): ExecutionRecord[] {
    return [...this.executionLog];
  }

  getOperatorAddress(): string {
    return this.keypair.publicKey();
  }
}

interface ExecutionRecord {
  type: string;
  success: boolean;
  txHash: string;
  target: string;
  timestamp: number;
}
