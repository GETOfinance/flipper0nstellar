export const CONTRACTS = {
  REGISTRY: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID || "",
  VAULT: process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID || "",
  DECISION_LOGGER: process.env.NEXT_PUBLIC_LOGGER_CONTRACT_ID || "",
  X402_PAYMENT: process.env.NEXT_PUBLIC_X402_PAYMENT_CONTRACT_ID || "",
};

export const STELLAR_NETWORKS = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    rpcUrl: "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/testnet",
  },
  mainnet: {
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    rpcUrl: "https://soroban-mainnet.stellar.org",
    horizonUrl: "https://horizon-mainnet.stellar.org",
    explorerUrl: "https://stellar.expert/explorer/public",
  },
};

export const USDC_CONTRACT_ID =
  process.env.NEXT_PUBLIC_USDC_CONTRACT_ID ||
  "CCW67TSZV3NSI4FS7FXTA6D3KQAJ5VW6UJRV3GSB7Q6Y2I3AIA7F6GCH";

export const RISK_LEVELS = ["None", "Low", "Medium", "High", "Critical"] as const;
export const RISK_COLORS = ["#6b7280", "#22c55e", "#eab308", "#f97316", "#ef4444"] as const;
export const ACTION_TYPES = ["Emergency Withdraw", "Rebalance", "Alert Only", "Stop Loss", "Take Profit"] as const;
export const AGENT_TIERS = ["Scout", "Guardian", "Sentinel", "Archon"] as const;
export const AGENT_STATUSES = ["Active", "Paused", "Decommissioned"] as const;
