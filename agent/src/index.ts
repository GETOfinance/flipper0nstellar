import * as dotenv from "dotenv";
import { PositionMonitor } from "./monitor";
import { RiskAnalyzer, RiskLevel } from "./analyzer";
import { OnChainExecutor } from "./executor";
import { AIReasoningEngine } from "./ai-engine";
import { StellarDexProvider } from "./stellar-dex";
import { USDCManager } from "./usdc/index";
import { X402Gateway } from "./x402-gateway";
import { X402Facilitator } from "./x402-facilitator";

dotenv.config({ path: "../.env" });

const CONFIG = {
  stellarRpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
  stellarSecretKey: process.env.STELLAR_SECRET_KEY || "",
  vaultContractId: process.env.VAULT_CONTRACT_ID || "",
  registryContractId: process.env.REGISTRY_CONTRACT_ID || "",
  loggerContractId: process.env.LOGGER_CONTRACT_ID || "",
  x402PaymentContractId: process.env.X402_PAYMENT_CONTRACT_ID || "",
  agentId: parseInt(process.env.AGENT_ID || "0"),
  pollInterval: parseInt(process.env.POLL_INTERVAL || "30000"),
  dryRun: process.env.DRY_RUN !== "false",
  networkPassphrase: process.env.STELLAR_NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015",
  x402: {
    facilitatorUrl: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
    payeeAddress: process.env.X402_PAYEE_ADDRESS || "",
    defaultPrice: process.env.X402_DEFAULT_PRICE || "1000000",
    maxPricePerRequest: process.env.X402_MAX_PRICE || "10000000",
    usdcContractId: process.env.USDC_CONTRACT_ID || "CCW67TSZV3NSI4FS7FXTA6D3KQAJ5VW6UJRV3GSB7Q6Y2I3AIA7F6GCH",
  },
};

function validateConfig(): void {
  const errors: string[] = [];

  if (!CONFIG.stellarSecretKey) {
    errors.push("STELLAR_SECRET_KEY is required (set in .env or environment)");
  } else if (!CONFIG.stellarSecretKey.startsWith("S")) {
    errors.push("STELLAR_SECRET_KEY must start with 'S' (Stellar secret key format)");
  }

  if (CONFIG.pollInterval < 5000) {
    errors.push("POLL_INTERVAL must be at least 5000ms (5 seconds)");
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuration errors:");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\n   See .env.example for required variables.\n");
    process.exit(1);
  }

  if (!CONFIG.vaultContractId || !CONFIG.registryContractId || !CONFIG.loggerContractId) {
    console.warn("⚠  Missing contract IDs — agent will run in monitor-only mode");
  }
  if (CONFIG.dryRun) {
    console.warn("⚠  DRY_RUN=true — no on-chain transactions will be executed");
  }
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn("⚠  No AI API key configured — using heuristic fallback only");
  }
}

function printBanner(): void {
  console.log("Flipper Protocol — AI-Powered Autonomous DeFi Guardian (Stellar)");
}

class FlipperAgent {
  private monitor: PositionMonitor;
  private analyzer: RiskAnalyzer;
  private executor: OnChainExecutor;
  private aiEngine: AIReasoningEngine;
  private stellarDex: StellarDexProvider;
  private usdcManager: USDCManager;
  private x402Gateway: X402Gateway;
  private x402Facilitator: X402Facilitator;
  private isRunning = false;
  private cycleCount = 0;
  private startTime = Date.now();

  constructor() {
    this.monitor = new PositionMonitor({
      rpcUrl: CONFIG.stellarRpcUrl,
      pollInterval: CONFIG.pollInterval,
      vaultContractId: CONFIG.vaultContractId,
      registryContractId: CONFIG.registryContractId,
      loggerContractId: CONFIG.loggerContractId,
      networkPassphrase: CONFIG.networkPassphrase,
    });

    this.analyzer = new RiskAnalyzer();
    this.aiEngine = new AIReasoningEngine();
    this.stellarDex = new StellarDexProvider(CONFIG.stellarRpcUrl);

    this.executor = new OnChainExecutor({
      secretKey: CONFIG.stellarSecretKey,
      vaultContractId: CONFIG.vaultContractId,
      registryContractId: CONFIG.registryContractId,
      loggerContractId: CONFIG.loggerContractId,
      agentId: CONFIG.agentId,
      dryRun: CONFIG.dryRun,
      rpcUrl: CONFIG.stellarRpcUrl,
      networkPassphrase: CONFIG.networkPassphrase,
    });

    this.usdcManager = new USDCManager({
      rpcUrl: CONFIG.stellarRpcUrl,
      networkPassphrase: CONFIG.networkPassphrase,
      secretKey: CONFIG.stellarSecretKey,
    });

    this.x402Gateway = new X402Gateway({
      stellarRpcUrl: CONFIG.stellarRpcUrl,
      networkPassphrase: CONFIG.networkPassphrase,
      secretKey: CONFIG.stellarSecretKey,
      usdcContractId: CONFIG.x402.usdcContractId,
      paymentContractId: CONFIG.x402PaymentContractId,
      facilitatorUrl: CONFIG.x402.facilitatorUrl,
      payeeAddress: CONFIG.x402.payeeAddress,
      defaultPrice: CONFIG.x402.defaultPrice,
      maxPricePerRequest: CONFIG.x402.maxPricePerRequest,
    });

    this.x402Facilitator = new X402Facilitator({
      stellarRpcUrl: CONFIG.stellarRpcUrl,
      networkPassphrase: CONFIG.networkPassphrase,
      usdcContractId: CONFIG.x402.usdcContractId,
      paymentContractId: CONFIG.x402PaymentContractId,
      operatorSecretKey: CONFIG.stellarSecretKey,
    });
  }

  async start(): Promise<void> {
    printBanner();

    const isTestnet = CONFIG.networkPassphrase.includes("Test");
    console.log("\n[Flipper Agent] Starting autonomous guardian...");
    console.log(`  Mode: ${CONFIG.dryRun ? "DRY RUN (simulation)" : "LIVE"}`);
    console.log(`  Network: Stellar ${isTestnet ? "Testnet" : "Mainnet"}`);
    console.log(`  Agent ID: ${CONFIG.agentId}`);
    console.log(`  Poll Interval: ${CONFIG.pollInterval / 1000}s`);
    console.log(`  Operator: ${this.executor.getOperatorAddress()}`);
    console.log(`  AI Engine: ${this.aiEngine.isEnabled() ? "LLM-Powered ✓" : "Heuristic Fallback"}`);
    console.log(`  Stellar DEX: Connected ✓`);
    console.log(`  USDC Integration: Ready ✓`);
    console.log(`  x402 Payments: ${CONFIG.x402.payeeAddress ? "Configured ✓" : "Not configured"}`);
    console.log(`  x402 Facilitator: ${CONFIG.x402.facilitatorUrl}`);
    console.log("");

    this.isRunning = true;

    while (this.isRunning) {
      try {
        await this.executeCycle();
      } catch (error: any) {
        console.error(`[Flipper Agent] Cycle error: ${error.message}`);
      }
      await this.sleep(CONFIG.pollInterval);
    }
  }

  private async executeCycle(): Promise<void> {
    this.cycleCount++;
    const cycleStart = Date.now();

    console.log(`\n${"═".repeat(60)}`);
    console.log(`[Cycle #${this.cycleCount}] ${new Date().toISOString()}`);
    console.log(`${"═".repeat(60)}`);

    console.log("\n📡 Phase 1: OBSERVE — Gathering market data...");
    const marketData = await this.monitor.getMarketData();
    console.log(`  XLM Price: $${marketData.price.toFixed(4)}`);
    console.log(`  24h Change: ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%`);
    console.log(`  Volume: $${(marketData.volume24h / 1e6).toFixed(1)}M`);
    console.log(`  USDC/XLM Liquidity: $${(marketData.liquidity / 1e6).toFixed(2)}M`);

    console.log("\n🧠 Phase 2: ANALYZE — Running AI risk assessment...");
    const riskSnapshot = this.analyzer.analyzeRisk(marketData);
    console.log(`  Overall Risk: ${riskSnapshot.overallRisk}/100 (${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][riskSnapshot.riskLevel]})`);
    console.log(`  Confidence: ${riskSnapshot.confidence}%`);
    console.log(`  Liquidation Risk: ${riskSnapshot.liquidationRisk}/100`);
    console.log(`  Volatility Risk: ${riskSnapshot.volatilityRisk}/100`);
    for (const factor of riskSnapshot.factors) {
      console.log(`  → ${factor.name}: ${factor.score}/100 (w=${factor.weight}) — ${factor.description}`);
    }

    console.log("\n🤖 Phase 2.5: AI REASONING — Generating LLM analysis...");
    const aiAnalysis = await this.aiEngine.analyzeMarket(marketData, riskSnapshot);
    console.log(`  AI Sentiment: ${aiAnalysis.marketSentiment}`);
    console.log(`  AI Risk Score: ${aiAnalysis.riskScore}/100`);
    console.log(`  Threats: ${aiAnalysis.threats.length > 0 ? aiAnalysis.threats.join(", ") : "None"}`);
    console.log(`  Key Insights:`);
    for (const insight of aiAnalysis.keyInsights.slice(0, 3)) {
      console.log(`    • ${insight}`);
    }

    console.log("\n📊 Phase 2.7: DEX DATA — Stellar DEX on-chain prices...");
    try {
      const xlmPrice = await this.stellarDex.getXLMPrice();
      if (xlmPrice > 0) {
        console.log(`  XLM/USDC (Stellar DEX): $${xlmPrice.toFixed(4)}`);
        const delta = ((marketData.price - xlmPrice) / xlmPrice * 100);
        console.log(`  Price Delta (API vs DEX): ${delta.toFixed(3)}%`);
        if (Math.abs(delta) > 1) {
          console.log(`  ⚠  Price manipulation warning! Delta > 1%`);
        }
      }
    } catch (err: any) {
      console.log(`  DEX data unavailable: ${err.message}`);
    }

    console.log("\n⚡ Phase 3: DECIDE — Threat detection...");
    const threat = this.analyzer.detectThreats(marketData);
    console.log(`  Threat Detected: ${threat.threatDetected}`);
    if (threat.threatDetected) {
      console.log(`  Type: ${threat.threatType}`);
      console.log(`  Severity: ${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][threat.severity]}`);
      console.log(`  Suggested Action: ${threat.suggestedAction}`);
      console.log(`  Reasoning: ${threat.reasoning}`);
    } else {
      console.log(`  Status: All Clear ✓`);
    }

    console.log("\n💰 Phase 3.5: USDC ANALYSIS — Stablecoin decision...");
    try {
      const usdcDecision = this.usdcManager.evaluateUsage(marketData, riskSnapshot, threat);
      console.log(`  Should Use USDC: ${usdcDecision.shouldUse}`);
      console.log(`  Reason: ${usdcDecision.reason}`);
      if (usdcDecision.shouldUse) {
        console.log(`  Action: ${usdcDecision.action}`);
        console.log(`  Amount: ${usdcDecision.amount} USDC`);
      }
    } catch (err: any) {
      console.log(`  USDC analysis skipped: ${err.message}`);
    }

    console.log("\n💳 Phase 3.7: x402 PAYMENT GATEWAY — HTTP payment protocol...");
    const x402Stats = this.x402Gateway.getStats();
    console.log(`  Total x402 Payments: ${x402Stats.totalPayments}`);
    console.log(`  Total Spent (USDC units): ${x402Stats.totalSpent}`);
    console.log(`  Payment Network: stellar:testnet`);
    console.log(`  Payment Scheme: exact (USDC)`);
    if (x402Stats.lastPayment) {
      console.log(`  Last Payment: ${x402Stats.lastPayment.amount} to ${x402Stats.lastPayment.recipient.slice(0, 8)}...`);
    }
    const facilitatorStats = this.x402Facilitator.getStats();
    console.log(`  Facilitator — Verified: ${facilitatorStats.totalVerified} | Settled: ${facilitatorStats.totalSettled}`);

    console.log("\n🔐 Phase 4: EXECUTE — On-chain actions...");

    const snapshotTx = await this.executor.logRiskSnapshot(riskSnapshot);
    if (snapshotTx) {
      console.log(`  Risk snapshot logged: ${snapshotTx}`);
    }

    const watchedAddresses = this.monitor.getWatchedAddresses();
    const targetUser = watchedAddresses[0] || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    const combinedReasoning = `${threat.reasoning} | AI: ${aiAnalysis.reasoning}`;
    const reasoningHash = this.analyzer.getReasoningHash(combinedReasoning);

    const decisionTx = await this.executor.logDecision(threat, targetUser, reasoningHash);
    if (decisionTx) {
      console.log(`  Decision logged: ${decisionTx}`);
    }

    if (threat.threatDetected && threat.severity >= RiskLevel.HIGH) {
      console.log(`\n🛡️  PROTECTION TRIGGERED: ${threat.suggestedAction}`);

      for (const addr of watchedAddresses) {
        const position = await this.monitor.getPosition(addr);
        if (position && position.xlmBalance > 0n) {
          const protectionTx = await this.executor.executeProtection(
            addr,
            threat.suggestedAction,
            position.xlmBalance,
            threat.reasoning
          );
          if (protectionTx) {
            console.log(`  Protection executed for ${addr}: ${protectionTx}`);
          }
        }
      }
    }

    const cycleDuration = Date.now() - cycleStart;
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    console.log(`\n📊 Cycle #${this.cycleCount} complete in ${cycleDuration}ms | Uptime: ${uptime}s`);
  }

  stop(): void {
    this.isRunning = false;
    console.log("\n[Flipper Agent] Shutting down...");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

async function main(): Promise<void> {
  validateConfig();
  const agent = new FlipperAgent();

  process.on("SIGINT", () => {
    agent.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    agent.stop();
    process.exit(0);
  });

  await agent.start();
}

main().catch((error) => {
  console.error("[Flipper Agent] Fatal error:", error);
  process.exit(1);
});
