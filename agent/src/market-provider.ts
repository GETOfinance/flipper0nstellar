import { MarketData } from "./analyzer";

interface CoinGeckoResponse {
  stellar: {
    usd: number;
    usd_24h_change: number;
    usd_24h_vol: number;
    usd_market_cap: number;
  };
}

export class LiveMarketProvider {
  private lastData: MarketData | null = null;
  private lastFetchTime = 0;
  private cacheDurationMs = 15000;

  async fetchLiveData(): Promise<MarketData> {
    if (this.lastData && Date.now() - this.lastFetchTime < this.cacheDurationMs) {
      return this.lastData;
    }

    try {
      const priceData = await this.fetchCoinGeckoData();
      const tvlData = await this.fetchDeFiLlamaData();

      const data: MarketData = {
        price: priceData.price,
        priceChange24h: priceData.priceChange24h,
        volume24h: priceData.volume24h,
        volumeChange: this.calculateVolumeChange(priceData.volume24h),
        liquidity: tvlData.tvl,
        liquidityChange: tvlData.change1d,
        holders: 500_000,
        topHolderPercent: 5,
      };

      this.lastData = data;
      this.lastFetchTime = Date.now();

      console.log(`[LiveMarket] Fetched: XLM=$${data.price.toFixed(4)}, 24h=${data.priceChange24h > 0 ? '+' : ''}${data.priceChange24h.toFixed(2)}%`);
      return data;
    } catch (err: any) {
      console.warn(`[LiveMarket] Live data failed: ${err.message}`);
      throw err;
    }
  }

  private async fetchCoinGeckoData(): Promise<{
    price: number;
    priceChange24h: number;
    volume24h: number;
  }> {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);

      const json = (await res.json()) as CoinGeckoResponse;
      const xlm = json.stellar;

      return {
        price: xlm.usd,
        priceChange24h: xlm.usd_24h_change,
        volume24h: xlm.usd_24h_vol,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchDeFiLlamaData(): Promise<{
    tvl: number;
    change1d: number;
  }> {
    const url = "https://api.llama.fi/v2/chains";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "Accept": "application/json" },
      });

      if (!res.ok) throw new Error(`DeFiLlama HTTP ${res.status}`);

      const chains = (await res.json()) as any[];
      const stellar = chains.find((c: any) => c.gecko_id === "stellar" || c.name === "Stellar");

      if (!stellar) return { tvl: 50_000_000, change1d: 0 };

      return {
        tvl: stellar.tvl ?? 50_000_000,
        change1d: stellar.change_1d ?? 0,
      };
    } catch {
      return { tvl: 50_000_000, change1d: 0 };
    } finally {
      clearTimeout(timeout);
    }
  }

  private calculateVolumeChange(currentVolume?: number): number {
    if (!currentVolume) return 0;
    const typicalVolume = 50_000_000;
    return ((currentVolume - typicalVolume) / typicalVolume) * 100;
  }
}
