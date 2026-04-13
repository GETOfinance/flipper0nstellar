import { MarketData, RiskSnapshot, ThreatAssessment, RiskLevel } from "../analyzer";

export interface USDCConfig {
  rpcUrl: string;
  networkPassphrase: string;
  secretKey: string;
  usdcContractId?: string;
  usdcIssuer?: string;
}

export interface USDCUsageDecision {
  shouldUse: boolean;
  reason: string;
  action: "hold" | "swap_to_usdc" | "swap_from_usdc" | "deposit" | "withdraw";
  amount: number;
  confidence: number;
}

export interface USDCBalance {
  total: number;
  available: number;
  locked: number;
}

export class USDCManager {
  private config: USDCConfig;

  constructor(config: USDCConfig) {
    this.config = config;
    console.log("[USDC Manager] Initialized for Stellar testnet");
  }

  evaluateUsage(
    market: MarketData,
    risk: RiskSnapshot,
    threat: ThreatAssessment
  ): USDCUsageDecision {
    if (risk.riskLevel >= RiskLevel.HIGH) {
      return {
        shouldUse: true,
        reason: "High risk detected — swapping to USDC for capital preservation",
        action: "swap_to_usdc",
        amount: 80,
        confidence: 90,
      };
    }

    if (risk.riskLevel >= RiskLevel.MEDIUM) {
      return {
        shouldUse: true,
        reason: "Elevated risk — partial position hedging with USDC",
        action: "swap_to_usdc",
        amount: 40,
        confidence: 75,
      };
    }

    if (market.priceChange24h < -5) {
      return {
        shouldUse: true,
        reason: "Significant price decline — consider USDC safe haven",
        action: "swap_to_usdc",
        amount: 30,
        confidence: 65,
      };
    }

    if (threat.threatDetected && threat.severity >= RiskLevel.MEDIUM) {
      return {
        shouldUse: true,
        reason: `Threat detected (${threat.threatType}) — USDC hedge recommended`,
        action: "swap_to_usdc",
        amount: 50,
        confidence: 70,
      };
    }

    if (market.priceChange24h > 5 && risk.riskLevel === RiskLevel.NONE) {
      return {
        shouldUse: true,
        reason: "Favorable conditions — consider moving USDC to XLM for gains",
        action: "swap_from_usdc",
        amount: 30,
        confidence: 60,
      };
    }

    return {
      shouldUse: false,
      reason: "Market conditions stable — no USDC action needed",
      action: "hold",
      amount: 0,
      confidence: 85,
    };
  }

  getContractId(): string {
    return this.config.usdcContractId || "CCW67TSZV3NSI4FS7FXTA6D3KQAJ5VW6UJRV3GSB7Q6Y2I3AIA7F6GCH";
  }

  getIssuer(): string {
    return this.config.usdcIssuer || "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NATPQ78ZQKT3HO5";
  }
}

export type { USDCConfig as USDCModuleConfig };
