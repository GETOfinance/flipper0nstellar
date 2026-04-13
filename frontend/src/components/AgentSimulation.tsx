"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Eye,
  Activity,
  Cpu,
  BarChart3,
  AlertTriangle,
  Zap,
  CheckCircle,
  Shield,
  ArrowRight,
  Loader2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface LiveMarketData {
  xlmPriceCoinGecko: number;
  xlmPriceStellarDex: number;
  priceChange24h: number;
  volume24h: number;
  stellarTvl: number;
  priceDelta: number;
  oracleStatus: string;
  marketCap: number;
}

interface PhaseConfig {
  id: number;
  key: string;
  label: string;
  sub: string;
  icon: React.ElementType;
  color: string;
  duration: number; // ms
}

const PHASES: PhaseConfig[] = [
  { id: 0, key: "observe",  label: "OBSERVE",    sub: "Fetching Market Data",       icon: Eye,            color: "#00e0ff", duration: 2800 },
  { id: 1, key: "analyze",  label: "ANALYZE",    sub: "5-Vector Risk Engine",       icon: Activity,       color: "#a855f7", duration: 3200 },
  { id: 2, key: "reason",   label: "AI REASON",  sub: "Multi-LLM Inference",        icon: Cpu,            color: "#f97316", duration: 3800 },
  { id: 3, key: "verify",   label: "DEX VERIFY", sub: "Stellar DEX Cross-Check",    icon: BarChart3,      color: "#f0b90b", duration: 2500 },
  { id: 4, key: "decide",   label: "DECIDE",     sub: "Threat Assessment",          icon: AlertTriangle,  color: "#ef4444", duration: 2200 },
  { id: 5, key: "execute",  label: "EXECUTE",    sub: "On-Chain Action",            icon: Zap,            color: "#22c55e", duration: 2000 },
];

function TypewriterText({ text, speed = 18 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;
    const interval = setInterval(() => {
      indexRef.current++;
      if (indexRef.current <= text.length) {
        setDisplayed(text.slice(0, indexRef.current));
      } else {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayed}
      {displayed.length < text.length && <span className="animate-pulse text-[#00e0ff]">▌</span>}
    </span>
  );
}

// ─── Simulation Data Generators ───────────────────────────────
function generateObserveData(market: LiveMarketData) {
  if (market.xlmPriceCoinGecko > 0) {
    return {
      lines: [
        `> fetch("coingecko/xlm") → $${market.xlmPriceCoinGecko.toFixed(4)}`,
        `> fetch("defillama/stellar") → TVL $${(market.stellarTvl / 1e9).toFixed(2)}B`,
        `> fetch("stellar-dex/price") → $${market.xlmPriceStellarDex > 0 ? market.xlmPriceStellarDex.toFixed(4) : "querying..."}`,
        `> 24h Change: ${market.priceChange24h >= 0 ? "+" : ""}${market.priceChange24h.toFixed(2)}%`,
        `> Volume: $${(market.volume24h / 1e9).toFixed(2)}B | Market Cap: $${(market.marketCap / 1e9).toFixed(1)}B`,
      ],
      summary: `Data collected: XLM at $${market.xlmPriceCoinGecko.toFixed(4)}, Stellar TVL $${(market.stellarTvl / 1e9).toFixed(2)}B`,
    };
  }
  return {
    lines: [
      '> fetch("coingecko/xlm") → $0.1200',
      '> fetch("defillama/stellar") → TVL $4.20B',
      '> fetch("stellar-dex/price") → $0.1199',
      "> 24h Change: +1.82%",
      "> Volume: $0.78B | Market Cap: $3.4B",
    ],
    summary: "Data collected: XLM at $0.1200, Stellar TVL $4.20B",
  };
}

function generateAnalyzeData(market: LiveMarketData) {
  const vol = Math.min(100, Math.round(Math.abs(market.priceChange24h) * 8 + 12));
  const liq = Math.min(100, Math.round(Math.abs(market.priceChange24h) * 3 + 8));
  const proto = Math.min(100, Math.round(market.priceDelta * 10 + 5));
  const sc = 12;
  const overall = Math.round((vol * 0.35 + liq * 0.25 + proto * 0.2 + sc * 0.15 + 10 * 0.05));
  return {
    lines: [
      `├─ Liquidation Risk:    ${liq}/100  [${"█".repeat(Math.floor(liq / 5))}${"░".repeat(20 - Math.floor(liq / 5))}]`,
      `├─ Volatility Score:    ${vol}/100  [${"█".repeat(Math.floor(vol / 5))}${"░".repeat(20 - Math.floor(vol / 5))}]`,
      `├─ Protocol Risk:       ${proto}/100  [${"█".repeat(Math.floor(proto / 5))}${"░".repeat(20 - Math.floor(proto / 5))}]`,
      `├─ Smart Contract Risk: ${sc}/100  [${"█".repeat(Math.floor(sc / 5))}${"░".repeat(20 - Math.floor(sc / 5))}]`,
      `└─ Weighted Overall:    ${overall}/100`,
    ],
    summary: `Risk scored: ${overall}/100 (${overall < 25 ? "LOW" : overall < 50 ? "MEDIUM" : overall < 75 ? "HIGH" : "CRITICAL"})`,
    overall,
  };
}

function generateReasonData(market: LiveMarketData) {
  const change = market.priceChange24h;
  const delta = market.priceDelta;
  let reasoning: string;

  if (Math.abs(change) > 5 && delta > 1) {
    reasoning = `THREAT DETECTED: XLM showing ${change.toFixed(2)}% volatility with ${delta.toFixed(3)}% oracle divergence. Volume anomaly suggests potential manipulation. Recommending defensive posture with stop-loss tightening.`;
  } else if (Math.abs(change) > 3) {
    reasoning = `ELEVATED VOLATILITY: XLM moved ${change >= 0 ? "+" : ""}${change.toFixed(2)}% in 24h. Volume at $${(market.volume24h / 1e9).toFixed(2)}B. Oracle cross-check shows ${delta.toFixed(3)}% delta — within normal range. Monitoring closely but no action needed.`;
  } else {
    reasoning = `ALL CLEAR: Market stable with XLM at $${market.xlmPriceCoinGecko > 0 ? market.xlmPriceCoinGecko.toFixed(4) : "0.1200"}. 24h change ${change >= 0 ? "+" : ""}${change.toFixed(2)}% is within normal parameters. Stellar TVL healthy at $${(market.stellarTvl / 1e9).toFixed(2)}B. No threats detected.`;
  }

  return {
    lines: [
      "> groq.chat.completions.create({",
      '>   model: "llama-3.3-70b-versatile",',
      ">   messages: [systemPrompt, marketData],",
      "> })",
      "",
      `AI: "${reasoning}"`,
    ],
    summary: reasoning.split(":")[0],
    reasoning,
  };
}

function generateVerifyData(market: LiveMarketData) {
  const cg = market.xlmPriceCoinGecko > 0 ? market.xlmPriceCoinGecko : 0.1200;
  const ps = market.xlmPriceStellarDex > 0 ? market.xlmPriceStellarDex : 0.1199;
  const delta = market.priceDelta > 0 ? market.priceDelta : 0.083;
  const status = delta < 1 ? "✓ CONSISTENT" : delta < 5 ? "⚠ DIVERGENCE" : "🚨 CRITICAL";

  return {
    lines: [
      `> Stellar DEX: SDEX Orderbook`,
      `> getPrice(XLM/USDC) = $${ps.toFixed(4)}`,
      `> CoinGecko API price:           $${cg.toFixed(4)}`,
      `> Delta: ${delta.toFixed(3)}%  →  ${status}`,
      delta < 1
        ? "> No oracle manipulation indicators detected"
        : "> WARNING: Price divergence exceeds threshold",
    ],
    summary: `Oracle check: ${status} (Δ${delta.toFixed(3)}%)`,
  };
}

function generateDecideData(market: LiveMarketData) {
  const change = Math.abs(market.priceChange24h);
  const delta = market.priceDelta;
  const risk = change > 10 ? "CRITICAL" : change > 5 ? "HIGH" : change > 3 ? "MEDIUM" : delta > 1 ? "MEDIUM" : "LOW";
  const confidence = Math.min(99, Math.round(85 + Math.random() * 12));
  const action = risk === "CRITICAL" || risk === "HIGH" ? "PROTECT" : "MONITOR";

  return {
    lines: [
      `> Threat Level:  ${risk}`,
      `> Confidence:    ${confidence}%`,
      `> Action:        ${action}`,
      `> Risk Factors:  volatility(${change.toFixed(1)}%), oracle_delta(${delta.toFixed(3)}%)`,
      action === "PROTECT"
        ? "> → Triggering emergency stop-loss at 95% threshold"
        : "> → Continue monitoring, next cycle in 30s",
    ],
    summary: `Decision: ${action} (${risk} risk, ${confidence}% confidence)`,
    action,
    risk,
  };
}

function generateExecuteData(action: string, risk: string) {
  if (action === "PROTECT") {
    return {
      lines: [
        "> Executing on-chain protection...",
        `> logDecision(type=2, risk=${risk}, confidence=96%)`,
        `> TX: ${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}...`,
        "> ✓ Decision logged on DecisionLogger",
        "> ✓ Stop-loss triggered on FlipperVault",
      ],
      summary: "Protection executed and logged on-chain",
    };
  }
  return {
    lines: [
      "> No action required — monitoring continues",
      `> logDecision(type=0, risk=${risk}, confidence=94%)`,
      `> TX: ${Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}...`,
      "> ✓ All-clear logged on DecisionLogger",
      "> ⏳ Next cycle starts in 30 seconds...",
    ],
    summary: "All-clear logged on-chain, cycle complete",
  };
}

// ─── Main Component ───────────────────────────────────────────
export default function AgentSimulation({ market }: { market: LiveMarketData }) {
  const [activePhase, setActivePhase] = useState(-1); // -1 = idle
  const [isRunning, setIsRunning] = useState(false);
  const [cycleCount, setCycleCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [currentLines, setCurrentLines] = useState<string[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [phaseSummary, setPhaseSummary] = useState("");
  const [decisionAction, setDecisionAction] = useState("MONITOR");
  const [decisionRisk, setDecisionRisk] = useState("LOW");
  const [completedPhases, setCompletedPhases] = useState<number[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((msg: string) => {
    setLogs((prev) => [...prev.slice(-30), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const runPhase = useCallback(
    async (phaseId: number) => {
      const phase = PHASES[phaseId];
      setActivePhase(phaseId);
      setLineIndex(0);
      setCurrentLines([]);
      setPhaseSummary("");
      addLog(`▶ Phase ${phaseId + 1}/6: ${phase.label} — ${phase.sub}`);

      let data: { lines: string[]; summary: string; action?: string; risk?: string };

      switch (phase.key) {
        case "observe":
          data = generateObserveData(market);
          break;
        case "analyze":
          data = generateAnalyzeData(market);
          break;
        case "reason":
          data = generateReasonData(market);
          break;
        case "verify":
          data = generateVerifyData(market);
          break;
        case "decide": {
          const d = generateDecideData(market);
          data = d;
          setDecisionAction(d.action);
          setDecisionRisk(d.risk);
          break;
        }
        case "execute":
          data = generateExecuteData(decisionAction, decisionRisk);
          break;
        default:
          data = { lines: [], summary: "" };
      }

      // Reveal lines progressively
      for (let i = 0; i < data.lines.length; i++) {
        await new Promise<void>((resolve) => {
          timerRef.current = setTimeout(() => {
            setCurrentLines((prev) => [...prev, data.lines[i]]);
            setLineIndex(i + 1);
            resolve();
          }, phase.duration / data.lines.length);
        });
      }

      // Phase complete
      setPhaseSummary(data.summary);
      setCompletedPhases((prev) => [...prev, phaseId]);
      addLog(`✓ ${phase.label} complete: ${data.summary}`);

      // Brief pause before next phase
      await new Promise((r) => setTimeout(r, 600));
    },
    [market, addLog, decisionAction, decisionRisk]
  );

  const startCycle = useCallback(async () => {
    setIsRunning(true);
    setCompletedPhases([]);
    setCycleCount((c) => c + 1);
    addLog("═══ Starting Agent Cycle ═══");

    for (let i = 0; i < PHASES.length; i++) {
      await runPhase(i);
    }

    addLog("═══ Cycle Complete — Next in 30s ═══");
    setActivePhase(-1);
    setIsRunning(false);
  }, [addLog, runPhase]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div className="glass-card glow-border p-6" style={{ borderRadius: "16px" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-lg font-semibold flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#00e0ff]" />
            Live Agent Simulation
            {isRunning && (
              <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                RUNNING
              </span>
            )}
          </h4>
          <p className="text-xs text-gray-500 mt-1">
            Watch Flipper execute a full 6-phase guardian cycle with{" "}
            {market.xlmPriceCoinGecko > 0 ? "live market data" : "simulated data"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {cycleCount > 0 && (
            <span className="text-xs text-gray-500 font-mono">Cycles: {cycleCount}</span>
          )}
          <button
            onClick={startCycle}
            disabled={isRunning}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              isRunning
                ? "bg-gray-700/50 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-[#00e0ff]/20 to-[#a855f7]/20 text-[#00e0ff] border border-[#00e0ff]/30 hover:border-[#00e0ff]/60 hover:scale-[1.02]"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Running...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Run Agent Cycle
              </>
            )}
          </button>
        </div>
      </div>

      {/* Phase Timeline */}
      <div className="flex items-center justify-between gap-1 mb-6 overflow-x-auto pb-2">
        {PHASES.map((phase, i) => {
          const isActive = activePhase === i;
          const isComplete = completedPhases.includes(i);
          const Icon = phase.icon;

          return (
            <div key={phase.key} className="flex items-center gap-1 flex-shrink-0">
              <div
                className={`relative flex flex-col items-center p-3 rounded-xl min-w-[100px] transition-all duration-500 ${
                  isActive ? "scale-105 ring-1" : ""
                }`}
                style={{
                  background: isActive
                    ? `${phase.color}18`
                    : isComplete
                    ? `${phase.color}0a`
                    : "rgba(0,0,0,0.2)",
                  border: `1px solid ${
                    isActive ? `${phase.color}60` : isComplete ? `${phase.color}30` : "rgba(255,255,255,0.03)"
                  }`,
                  ...(isActive ? { boxShadow: `0 0 15px ${phase.color}20` } : {}),
                }}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 rounded-xl animate-pulse opacity-20"
                    style={{ background: phase.color }}
                  />
                )}
                <div className="relative">
                  {isActive ? (
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: phase.color }} />
                  ) : isComplete ? (
                    <CheckCircle className="w-5 h-5" style={{ color: phase.color }} />
                  ) : (
                    <Icon className="w-5 h-5 text-gray-600" />
                  )}
                </div>
                <p
                  className="text-[10px] font-bold mt-1.5 tracking-wider"
                  style={{ color: isActive || isComplete ? phase.color : "#6b7280" }}
                >
                  {phase.label}
                </p>
                <p className="text-[9px] text-gray-600 mt-0.5">{phase.sub}</p>
              </div>
              {i < PHASES.length - 1 && (
                <ArrowRight
                  className="w-3 h-3 flex-shrink-0 hidden sm:block"
                  style={{ color: isComplete ? PHASES[i + 1].color : "#374151" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Live Output Terminal */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Phase Output */}
        <div
          className="rounded-xl p-4 font-mono text-xs min-h-[200px] max-h-[280px] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,224,255,0.1)" }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-gray-600 text-[10px] ml-2">
              {activePhase >= 0 ? `aegis-agent/${PHASES[activePhase].key}` : "aegis-agent/idle"}
            </span>
          </div>

          {activePhase < 0 && currentLines.length === 0 && (
            <div className="text-gray-600 flex items-center gap-2 mt-8 justify-center">
              <Shield className="w-4 h-4" />
              <span>Click &quot;Run Agent Cycle&quot; to start</span>
            </div>
          )}

          {currentLines.map((line, i) => (
            <div key={i} className="leading-relaxed" style={{ color: i === lineIndex - 1 ? "#e2e8f0" : "#9ca3af" }}>
              {i === currentLines.length - 1 ? <TypewriterText text={line} speed={12} /> : line}
            </div>
          ))}

          {phaseSummary && (
            <div className="mt-3 pt-2" style={{ borderTop: "1px solid rgba(0,224,255,0.1)" }}>
              <span className="text-green-400">✓ {phaseSummary}</span>
            </div>
          )}
        </div>

        {/* Running Log */}
        <div
          className="rounded-xl p-4 font-mono text-[11px] min-h-[200px] max-h-[280px] overflow-y-auto"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,85,247,0.1)" }}
        >
          <div className="flex items-center gap-2 mb-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <Activity className="w-3 h-3 text-purple-400" />
            <span className="text-gray-600 text-[10px]">agent-log</span>
          </div>

          {logs.length === 0 && (
            <div className="text-gray-600 flex items-center gap-2 mt-8 justify-center">
              <Activity className="w-4 h-4" />
              <span>Agent log will appear here</span>
            </div>
          )}

          {logs.map((log, i) => (
            <div
              key={i}
              className={`leading-relaxed ${
                log.includes("═══") ? "text-[#00e0ff] font-bold mt-1" : log.includes("✓") ? "text-green-400" : "text-gray-500"
              }`}
            >
              {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Phase Stats Bar */}
      {completedPhases.length > 0 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Phases: {completedPhases.length}/6</span>
            <span>|</span>
            <span>
              Data:{" "}
              {market.xlmPriceCoinGecko > 0 ? (
                <span className="text-green-400">Live (CoinGecko + Stellar DEX)</span>
              ) : (
                <span className="text-yellow-400">Simulated</span>
              )}
            </span>
          </div>
          {completedPhases.length === 6 && (
            <div className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" />
              Cycle complete — all phases executed
            </div>
          )}
        </div>
      )}
    </div>
  );
}
