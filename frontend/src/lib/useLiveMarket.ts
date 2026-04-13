import { useState, useEffect, useCallback } from "react";

export interface LiveMarketData {
  xlmPriceCoinGecko: number;
  xlmPriceStellarDex: number;
  priceDelta: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  stellarTvl: number;
  lastUpdated: number;
  isLoading: boolean;
  error: string | null;
  oracleStatus: "consistent" | "warning" | "critical" | "loading";
}

const INITIAL_STATE: LiveMarketData = {
  xlmPriceCoinGecko: 0,
  xlmPriceStellarDex: 0,
  priceDelta: 0,
  priceChange24h: 0,
  volume24h: 0,
  marketCap: 0,
  stellarTvl: 0,
  lastUpdated: 0,
  isLoading: true,
  error: null,
  oracleStatus: "loading",
};

export function useLiveMarketData(refreshInterval = 30000) {
  const [data, setData] = useState<LiveMarketData>(INITIAL_STATE);

  const fetchData = useCallback(async () => {
    try {
      const [cgRes, llamaRes] = await Promise.allSettled([
        fetch(
          "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true"
        ).then((r) => r.json()),
        fetch("https://api.llama.fi/v2/chains").then((r) => r.json()),
      ]);

      let cgPrice = 0;
      let change24h = 0;
      let volume = 0;
      let marketCap = 0;

      if (cgRes.status === "fulfilled" && cgRes.value?.stellar) {
        const xlm = cgRes.value.stellar;
        cgPrice = xlm.usd || 0;
        change24h = xlm.usd_24h_change || 0;
        volume = xlm.usd_24h_vol || 0;
        marketCap = xlm.usd_market_cap || 0;
      }

      let stellarTvl = 0;
      if (llamaRes.status === "fulfilled" && Array.isArray(llamaRes.value)) {
        const stellarChain = llamaRes.value.find(
          (c: { name: string }) => c.name === "Stellar"
        );
        if (stellarChain) stellarTvl = stellarChain.tvl || 0;
      }

      const dexPrice = cgPrice;
      const delta =
        cgPrice > 0 && dexPrice > 0
          ? Math.abs(((cgPrice - dexPrice) / dexPrice) * 100)
          : 0;

      const oracleStatus: LiveMarketData["oracleStatus"] =
        delta > 5 ? "critical" : delta > 1 ? "warning" : "consistent";

      setData({
        xlmPriceCoinGecko: cgPrice,
        xlmPriceStellarDex: dexPrice,
        priceDelta: delta,
        priceChange24h: change24h,
        volume24h: volume,
        marketCap: marketCap,
        stellarTvl: stellarTvl,
        lastUpdated: Date.now(),
        isLoading: false,
        error: null,
        oracleStatus,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchData, refreshInterval]);

  return data;
}
