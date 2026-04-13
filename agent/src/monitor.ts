import { MarketData, PositionData } from "./analyzer";
import { LiveMarketProvider } from "./market-provider";

export interface MonitorConfig {
  rpcUrl: string;
  pollInterval: number;
  vaultContractId: string;
  registryContractId: string;
  loggerContractId: string;
  networkPassphrase: string;
}

export class PositionMonitor {
  private config: MonitorConfig;
  private watchedAddresses: Set<string> = new Set();
  private liveMarket: LiveMarketProvider;
  private useLiveData: boolean;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.liveMarket = new LiveMarketProvider();
    this.useLiveData = process.env.USE_LIVE_DATA !== "false";

    console.log("[Flipper Monitor] Position monitor initialized (Stellar)");
    console.log(`  Vault: ${config.vaultContractId}`);
    console.log(`  Registry: ${config.registryContractId}`);
    console.log(`  Logger: ${config.loggerContractId}`);
  }

  watchAddress(address: string): void {
    this.watchedAddresses.add(address);
    console.log(`[Flipper Monitor] Watching: ${address}`);
  }

  async getPosition(userAddress: string): Promise<PositionData | null> {
    try {
      return {
        userAddress,
        xlmBalance: 0n,
        tokenBalances: new Map(),
        riskProfile: {
          maxSlippage: 100,
          stopLossThreshold: 1000,
          maxSingleActionValue: 0n,
          allowAutoWithdraw: true,
          allowAutoSwap: false,
        },
        lastActionTimestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Flipper Monitor] Error fetching position for ${userAddress}:`, error);
      return null;
    }
  }

  async getMarketData(): Promise<MarketData> {
    if (this.useLiveData) {
      try {
        return await this.liveMarket.fetchLiveData();
      } catch (err: any) {
        console.warn(`[Flipper Monitor] Live data failed, falling back to simulation: ${err.message}`);
      }
    }

    return {
      price: 0.35,
      priceChange24h: 0,
      volume24h: 50_000_000,
      volumeChange: 0,
      liquidity: 200_000_000,
      liquidityChange: 0,
      holders: 500_000,
      topHolderPercent: 5,
    };
  }

  async getAgentStats(_agentId: number): Promise<{
    totalDecisions: number;
    successfulActions: number;
    totalValueProtected: bigint;
  } | null> {
    try {
      return {
        totalDecisions: 0,
        successfulActions: 0,
        totalValueProtected: 0n,
      };
    } catch (error) {
      console.error("[Flipper Monitor] Error fetching agent stats:", error);
      return null;
    }
  }

  getWatchedAddresses(): string[] {
    return [...this.watchedAddresses];
  }
}
