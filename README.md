# Flipper Protocol

AI-Powered Autonomous DeFi Guardian Agent for Stellar.

An autonomous AI agent — powered by multi-LLM reasoning + Stellar DEX on-chain data — that monitors your DeFi positions 24/7, detects risks in real-time, and executes protective on-chain transactions before you lose money.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│   Next.js 14 Dashboard — Live data, wallet, contract reads  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     AGENT LAYER                              │
│  Risk Analyzer → AI Engine → DEX Verifier → USDC Manager    │
│  x402 Payment Gateway → On-Chain Executor                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   CONTRACT LAYER (Soroban)                   │
│  FlipperRegistry · FlipperVault · DecisionLogger · X402Payment│
└─────────────────────────────────────────────────────────────┘
```

### Agent Decision Cycle (7 Phases)

| Phase | Action | Data Source |
|-------|--------|-------------|
| OBSERVE | Fetch market data & positions | CoinGecko, DeFiLlama |
| ANALYZE | 5-factor risk assessment | Price, liquidity, volume, holders, momentum |
| AI REASON | LLM-powered threat analysis | OpenAI / OpenRouter / Ollama / Groq |
| DEX VERIFY | On-chain price & liquidity verification | Stellar DEX |
| DECIDE | Determine action & severity | Risk thresholds |
| USDC ANALYSIS | Evaluate USDC hedging | On-chain USDC/XLM rates |
| x402 PAYMENT | Pay for premium data/APIs | x402 protocol via USDC |
| EXECUTE | Submit protection transaction | FlipperVault on-chain |

---

## Smart Contracts (Soroban)

Built with [soroban-sdk](https://soroban.stellar.org) v22, targeting `wasm32-unknown-unknown`.

### FlipperRegistry

NFT-based guardian agent registry with reputation scoring.

| Function | Description |
|----------|-------------|
| `register_agent` | Register a new guardian agent (NFT mint) |
| `set_agent_status` | Active / Paused / Decommissioned |
| `upgrade_agent_tier` | Scout → Guardian → Sentinel → Archon |
| `record_agent_action` | Track successful/failed actions |
| `give_feedback` | User feedback with score (1–5) |
| `get_reputation_score` | Weighted reputation (0–1000) |
| `get_success_rate` | Action success percentage |

### FlipperVault

Asset management vault with automated protection execution.

| Function | Description |
|----------|-------------|
| `deposit` / `deposit_token` | Deposit XLM or SPL tokens |
| `withdraw` / `withdraw_token` | Withdraw assets |
| `authorize_agent` / `revoke_agent` | Grant/revoke agent control |
| `update_risk_profile` | Set risk tolerance per user |
| `execute_protection` | Agent-triggered protection action |
| `emergency_withdraw` | Instant withdrawal in critical situations |

**Protection Actions:** EmergencyWithdraw, Rebalance, AlertOnly, StopLoss, TakeProfit

### DecisionLogger

Immutable on-chain audit trail for all AI decisions.

| Function | Description |
|----------|-------------|
| `log_decision` | Record an AI decision with reasoning hash |
| `update_risk_snapshot` | Store current risk assessment |
| `get_agent_decisions` | Query decisions by agent |
| `get_user_decisions` | Query decisions by user |
| `get_latest_risk` | Current risk snapshot |

**Decision Types:** RiskAssessment, ThreatDetected, ProtectionTriggered, AllClear, MarketAnalysis, PositionReview

### X402Payment

HTTP 402 payment protocol for on-chain USDC settlement on Stellar.

| Function | Description |
|----------|-------------|
| `create_payment` | Initiate a payment |
| `verify_payment` | Verify payment validity |
| `settle_payment` | Finalize payment on-chain |
| `expire_payment` / `refund_payment` | Handle expired/refunded payments |
| `get_stats` | Total volume, payments, verified count |

---

## AI Reasoning Engine

Multi-provider LLM support with heuristic fallback:

| Provider | Config Key | Default Model |
|----------|-----------|---------------|
| OpenAI | `OPENAI_API_KEY` | GPT-4o-mini |
| OpenRouter | `OPENROUTER_API_KEY` | Configurable |
| LM Studio | `LMSTUDIO_API_URL` | Local |
| Ollama | `OLLAMA_API_URL` | Local |
| Groq | `GROQ_API_KEY` | Configurable |

When no API key is configured, the engine falls back to rule-based heuristic analysis using configurable thresholds for price drops, liquidity changes, volume spikes, and whale concentration.

---

### Deployed Contracts (Testnet)

| Contract | Contract ID | Explorer |
|----------|------------|----------|
| FlipperRegistry | `CCC2TS24I5MSHTDJBH5MHVPRNBLPRL5RGDH7JYT2ABIFK26TKSSNYYNM` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CCC2TS24I5MSHTDJBH5MHVPRNBLPRL5RGDH7JYT2ABIFK26TKSSNYYNM) |
| FlipperVault | `CA3G7CVT5B76T6BIRVX72GAYOL6ZNFDE5FF3KLJZK24YY3CJRJTXL5BD` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CA3G7CVT5B76T6BIRVX72GAYOL6ZNFDE5FF3KLJZK24YY3CJRJTXL5BD) |
| DecisionLogger | `CAEQS573TRQCTN6SBZAMOKO3XAXKIJAOX3JBLXKMJZSNHR6KTJBUWC6D` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAEQS573TRQCTN6SBZAMOKO3XAXKIJAOX3JBLXKMJZSNHR6KTJBUWC6D) |
| X402Payment | `CAF5FOI7XMDGH4WRAQXNSABHT5LY5AHXMT65U7XCEOBLTVPQV5BSUHAL` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CAF5FOI7XMDGH4WRAQXNSABHT5LY5AHXMT65U7XCEOBLTVPQV5BSUHAL) |
| USDC (SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA) |
| Native XLM (SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC) |



## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) with `wasm32-unknown-unknown` target
- [Stellar CLI](https://soroban.stellar.org/docs/getting-started/setup) (optional, for manual interactions)

### 1. Clone & Install

```bash
git clone <repo-url> && cd flipper-protocol
npm install
cd agent && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
# Required
STELLAR_SECRET_KEY=S...          # Your Stellar testnet secret key
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Choose at least one LLM provider
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
AI_MODEL=openai/gpt-oss-120b:free
```

Fund your testnet account at [Stellar Lab](https://lab.stellar.org/account/fund).

### 3. Build Contracts

```bash
npm run compile:contracts
```

### 4. Deploy to Testnet

```bash
npm run deploy:testnet
```

This deploys all 4 contracts, configures cross-contract permissions, and saves addresses to `deployment.json`.

### 5. Start the Agent

```bash
cd agent
npm run dev
```

Or run the simulation (no live network required):

```bash
npm run simulate
```

### 6. Start the Frontend

```bash
npm run frontend:dev
```

---

## Project Structure

```
flipper-protocol/
├── contracts/                    # Soroban smart contracts (Rust)
│   ├── flipper-registry/         # Agent NFT registry + reputation
│   ├── flipper-vault/            # Asset vault + protection execution
│   ├── decision-logger/          # On-chain decision audit trail
│   └── x402-payment/             # HTTP 402 payment settlement
├── agent/                        # AI Guardian Agent (TypeScript)
│   └── src/
│       ├── index.ts              # Main agent loop (7-phase cycle)
│       ├── ai-engine.ts          # Multi-LLM reasoning engine
│       ├── analyzer.ts           # 5-factor risk analysis
│       ├── executor.ts           # Stellar on-chain executor
│       ├── monitor.ts            # Position & market monitor
│       ├── stellar-dex.ts        # Stellar DEX data provider
│       ├── market-provider.ts    # Live market data (CoinGecko/DeFiLlama)
│       ├── usdc/                 # USDC hedging strategy
│       ├── x402-gateway.ts       # x402 HTTP payment client
│       ├── x402-facilitator.ts   # x402 payment verification
│       └── simulate.ts           # 5-scenario simulation
├── frontend/                     # Next.js 14 dashboard
│   └── src/
│       ├── app/                  # App router + x402 API routes
│       ├── components/           # UI components
│       └── lib/                  # Hooks, constants, Stellar utils
├── scripts/
│   └── deploy.ts                 # Stellar testnet deployment
└── package.json
```

---

## x402 Payment Protocol

Flipper integrates the [x402](https://x402.org) protocol for machine-to-machine payments on Stellar:

- **Gateway** (`agent/src/x402-gateway.ts`): Handles HTTP 402 responses, executes USDC transfers on Soroban, verifies settlement
- **Facilitator** (`agent/src/x402-facilitator.ts`): Verifies payment authenticity and on-chain finalization
- **On-chain** (`contracts/x402-payment/`): Soroban contract for payment creation, verification, and settlement
- **API Routes** (`frontend/src/app/api/x402/`): `/verify`, `/settle`, `/stats` endpoints

---

## License

[MIT](./LICENSE)
