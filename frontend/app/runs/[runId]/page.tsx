"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { formatDecisionTrace } from "@/lib/reasoning";
import { BacktestOverviewChart } from "@/components/BacktestOverviewChart";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: "10px 12px", background: "#fafafa" }}>
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function fmtPct(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(2)}%`;
}
function fmtNum(v: any) {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return x.toFixed(2);
}

export default function RunPage({ params }: { params: { runId: string } }) {
  const [results, setResults] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [equity, setEquity] = useState<any>(null); // {SYM: [{t,equity}]}

  const [symbol, setSymbol] = useState<string>("");
  const [ohlcv, setOhlcv] = useState<any[] | null>(null);

  const [explain, setExplain] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const r = await api.getRunResults(params.runId);
    const t = await api.getTrades(params.runId);
    const eq = await api.getEquity(params.runId);

    setEquity(eq.equity);
    setResults(r);
    setTrades(t);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, [params.runId]);

  const symbols = useMemo(() => {
    const ms = results?.metrics?.symbols;
    if (Array.isArray(ms) && ms.length) return ms.map((x: any) => x.symbol);
    if (equity && typeof equity === "object") return Object.keys(equity);
    return [];
  }, [results, equity]);

  useEffect(() => {
    if (!symbol && symbols.length) setSymbol(symbols[0]);
  }, [symbols, symbol]);

  useEffect(() => {
    if (!symbol) return;
    (async () => {
      setOhlcv(null);
      const resp = await api.getOhlcv(params.runId, symbol);
      setOhlcv(resp.ohlcv ?? []);
    })().catch((e) => setMsg(e.message));
  }, [params.runId, symbol]);

  const symbolTrades = useMemo(() => trades.filter((t) => t.symbol === symbol), [trades, symbol]);
  const equityCurve = useMemo(() => (equity ? equity[symbol] ?? [] : []), [equity, symbol]);

  const perSymbolMetrics = useMemo(() => {
    const ms = results?.metrics?.symbols;
    if (!Array.isArray(ms)) return {};
    return ms.find((x: any) => x.symbol === symbol) ?? {};
  }, [results, symbol]);

  async function explainTrade(tradeId: number) {
    try {
      const data = await api.explainTrade(params.runId, tradeId);
      setExplain(data);
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <a href="/runs">← back to runs</a>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Run {params.runId}</h2>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#666" }}>Symbol</span>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ padding: 8, borderRadius: 10 }}>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
        <Stat label="Total Return" value={fmtPct(perSymbolMetrics.total_return)} />
        <Stat label="CAGR" value={fmtPct(perSymbolMetrics.cagr)} />
        <Stat label="Sharpe" value={fmtNum(perSymbolMetrics.sharpe)} />
        <Stat label="Max Drawdown" value={fmtPct(-Math.abs(Number(perSymbolMetrics.max_drawdown ?? 0)))} />
        <Stat label="Trades" value={`${perSymbolMetrics.num_trades ?? 0}`} />
        <Stat label="Win Rate" value={fmtPct(perSymbolMetrics.win_rate)} />
        <Stat
          label="Profit Factor"
          value={perSymbolMetrics.profit_factor === Infinity ? "∞" : fmtNum(perSymbolMetrics.profit_factor)}
        />
        <Stat label="Final Equity" value={fmtNum(perSymbolMetrics.final_equity)} />
      </div>

      {/* Chart */}
      {ohlcv?.length ? (
        <BacktestOverviewChart
          title={`${symbol} · Candles + Trades + Equity`}
          data={ohlcv}
          trades={symbolTrades}
          equityCurve={equityCurve}
          initialCash={Number(perSymbolMetrics.initial_cash ?? 10_000)}
        />
      ) : (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, color: "#666" }}>
          Loading candles…
        </div>
      )}

      {/* Trades list */}
      <div style={{ display: "grid", gap: 8 }}>
        <h3 style={{ margin: 0 }}>Trades ({symbol || "—"})</h3>

        {symbolTrades.map((t) => (
          <div key={t.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <div>
              <b>{t.side}</b> {t.symbol} qty={Number(t.qty).toFixed(4)} price={Number(t.price).toFixed(4)}
            </div>
            <div style={{ color: "#444" }}>{t.timestamp}</div>
            <div style={{ color: "#444" }}>
              pnl: {Number(t.pnl).toFixed(4)} · fee: {Number(t.fee).toFixed(4)} · slip: {Number(t.slippage).toFixed(4)}
            </div>
            <button onClick={() => explainTrade(t.id)}>Why?</button>
          </div>
        ))}
      </div>

      {/* Decision trace */}
      {explain && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Decision trace</h3>
          <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, marginBottom: 10 }}>
            <b>Summary:</b> {formatDecisionTrace(explain.decision_trace)}
          </div>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(explain, null, 2)}</pre>
        </div>
      )}

      {/* Raw metrics */}
      {results && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Metrics (raw)</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(results.metrics, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}