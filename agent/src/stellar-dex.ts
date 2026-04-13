import { rpc } from "@stellar/stellar-sdk";

export interface StellarData {
  xlmPrice: number;
  usdcPrice: number;
  xlmUsdcLiquidity: number;
  pairVolume24h: number;
}

export class StellarDexProvider {
  private server: rpc.Server;
  private lastPrice = 0;
  private lastFetchTime = 0;
  private cacheDurationMs = 15000;

  constructor(rpcUrl: string) {
    this.server = new rpc.Server(rpcUrl);
    console.log("[Stellar DEX] Provider initialized");
  }

  async getXLMPrice(): Promise<number> {
    if (this.lastPrice && Date.now() - this.lastFetchTime < this.cacheDurationMs) {
      return this.lastPrice;
    }

    try {
      const url = "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json() as any;
      const price = json.stellar?.usd ?? 0;

      if (price > 0) {
        this.lastPrice = price;
        this.lastFetchTime = Date.now();
      }

      return price;
    } catch (err: any) {
      console.warn(`[Stellar DEX] Price fetch failed: ${err.message}`);
      return this.lastPrice || 0.35;
    }
  }

  async getUSDCXLMPrice(): Promise<number> {
    return this.getXLMPrice();
  }

  async getLiquidityDepth(): Promise<number> {
    try {
      const url = "https://api.llama.fi/v2/chains";
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (!res.ok) return 50_000_000;

      const chains = await res.json() as any[];
      const stellar = chains.find((c: any) => c.name === "Stellar");
      return stellar?.tvl ?? 50_000_000;
    } catch {
      return 50_000_000;
    }
  }

  async getTokenRisk(tokenCode: string): Promise<{
    riskScore: number;
    liquidityDepth: number;
    priceImpact: number;
  }> {
    const price = await this.getXLMPrice();
    const liquidity = await this.getLiquidityDepth();

    return {
      riskScore: tokenCode === "XLM" ? 5 : 15,
      liquidityDepth: liquidity,
      priceImpact: Math.max(0.01, 1000 / liquidity),
    };
  }
}
