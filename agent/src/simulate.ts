import { RiskAnalyzer, MarketData, RiskLevel } from "./analyzer";

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   FLIPPER PROTOCOL — AI GUARDIAN SIMULATION (Stellar)       ║
║   Demonstrating autonomous risk detection & protection        ║
╚═══════════════════════════════════════════════════════════════╝
`);

const analyzer = new RiskAnalyzer();

const scenarios: { name: string; data: MarketData; expected: string }[] = [
  {
    name: "🟢 Normal Market — All Clear",
    data: {
      price: 0.35,
      priceChange24h: 1.2,
      volume24h: 50_000_000,
      volumeChange: 15,
      liquidity: 200_000_000,
      liquidityChange: 2.5,
      holders: 500_000,
      topHolderPercent: 5,
    },
    expected: "No threats — agent monitors passively",
  },
  {
    name: "🟡 Moderate Volatility — Increased Monitoring",
    data: {
      price: 0.33,
      priceChange24h: -6.5,
      volume24h: 80_000_000,
      volumeChange: 60,
      liquidity: 180_000_000,
      liquidityChange: -8,
      holders: 498_000,
      topHolderPercent: 8,
    },
    expected: "Low threat — abnormal volume detected",
  },
  {
    name: "🟠 High Risk — Price Crash",
    data: {
      price: 0.28,
      priceChange24h: -22,
      volume24h: 200_000_000,
      volumeChange: 300,
      liquidity: 100_000_000,
      liquidityChange: -18,
      holders: 480_000,
      topHolderPercent: 12,
    },
    expected: "HIGH threat — stop-loss triggered",
  },
  {
    name: "🔴 CRITICAL — Rug Pull Pattern",
    data: {
      price: 0.12,
      priceChange24h: -68,
      volume24h: 500_000_000,
      volumeChange: 1200,
      liquidity: 20_000_000,
      liquidityChange: -85,
      holders: 400_000,
      topHolderPercent: 45,
    },
    expected: "CRITICAL — emergency withdrawal triggered",
  },
  {
    name: "🐋 Whale Concentration Warning",
    data: {
      price: 0.34,
      priceChange24h: -2,
      volume24h: 60_000_000,
      volumeChange: 40,
      liquidity: 170_000_000,
      liquidityChange: -3,
      holders: 450_000,
      topHolderPercent: 72,
    },
    expected: "HIGH — whale concentration risk",
  },
];

for (let i = 0; i < scenarios.length; i++) {
  const scenario = scenarios[i];

  console.log(`\n${"═".repeat(65)}`);
  console.log(`  Scenario ${i + 1}/${scenarios.length}: ${scenario.name}`);
  console.log(`  Expected: ${scenario.expected}`);
  console.log(`${"═".repeat(65)}\n`);

  console.log("📡 Market Data:");
  console.log(`   XLM Price: $${scenario.data.price}`);
  console.log(`   24h Change: ${scenario.data.priceChange24h > 0 ? '+' : ''}${scenario.data.priceChange24h}%`);
  console.log(`   Volume: $${(scenario.data.volume24h / 1e6).toFixed(0)}M (${scenario.data.volumeChange > 0 ? '+' : ''}${scenario.data.volumeChange}%)`);
  console.log(`   Liquidity: $${(scenario.data.liquidity / 1e6).toFixed(1)}M (${scenario.data.liquidityChange > 0 ? '+' : ''}${scenario.data.liquidityChange}%)`);
  console.log(`   Top Holder: ${scenario.data.topHolderPercent}%`);

  const risk = analyzer.analyzeRisk(scenario.data);
  const LEVELS = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

  console.log("\n🧠 AI Risk Analysis:");
  console.log(`   Overall Risk: ${risk.overallRisk}/100 [${LEVELS[risk.riskLevel]}]`);
  console.log(`   Confidence: ${risk.confidence}%`);
  console.log(`   ├─ Liquidation: ${risk.liquidationRisk}/100`);
  console.log(`   ├─ Volatility:  ${risk.volatilityRisk}/100`);
  console.log(`   ├─ Protocol:    ${risk.protocolRisk}/100`);
  console.log(`   └─ Smart Contract: ${risk.smartContractRisk}/100`);

  for (const factor of risk.factors) {
    const bar = "█".repeat(Math.round(factor.score / 5)) + "░".repeat(20 - Math.round(factor.score / 5));
    console.log(`   [${bar}] ${factor.name}: ${factor.score}/100`);
  }

  const threat = analyzer.detectThreats(scenario.data);

  console.log("\n⚡ Threat Detection:");
  if (threat.threatDetected) {
    console.log(`   🚨 THREAT: ${threat.threatType}`);
    console.log(`   Severity: ${LEVELS[threat.severity]}`);
    console.log(`   Action: ${threat.suggestedAction}`);
    console.log(`   Reasoning: ${threat.reasoning.slice(0, 120)}...`);
  } else {
    console.log("   ✅ No threats detected — all systems nominal");
  }

  console.log("\n🔐 Agent Decision:");
  if (threat.severity >= RiskLevel.CRITICAL) {
    console.log("   🛡️  ACTION: EMERGENCY WITHDRAW — protecting all user funds");
  } else if (threat.severity >= RiskLevel.HIGH) {
    console.log("   ⚠️  ACTION: STOP-LOSS / REDUCE EXPOSURE");
  } else if (threat.severity >= RiskLevel.LOW) {
    console.log("   👁️  ACTION: INCREASED MONITORING");
  } else {
    console.log("   ✅ ACTION: CONTINUE MONITORING");
  }

  const hash = analyzer.getReasoningHash(risk.reasoning);
  console.log(`   📝 Reasoning Hash: ${hash.slice(0, 20)}...`);
}

console.log(`\n${"═".repeat(65)}`);
console.log("  SIMULATION COMPLETE (Stellar Testnet)");
console.log(`${"═".repeat(65)}`);
console.log(`\n  Scenarios processed: ${scenarios.length}`);
console.log(`  The Flipper Agent successfully analyzed all scenarios on Stellar.`);
console.log("");
