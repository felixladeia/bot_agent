"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatDecisionTrace } from "@/lib/reasoning";
import { EquityDrawdownChart } from "@/components/EquityDrawdownChart";

function LineChart({ points }: { points: { t: string; equity: number }[] }) {
  const w = 860, h = 220, pad = 20;
  const ys = points.map(p => p.equity);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scaleX = (i: number) => pad + (i * (w - 2*pad)) / Math.max(1, points.length - 1);
  const scaleY = (y: number) => pad + (h - 2*pad) * (1 - (y - minY) / Math.max(1e-9, (maxY - minY)));

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(i)} ${scaleY(p.equity)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ border: "1px solid #eee", borderRadius: 8 }}>
      <path d={d} fill="none" stroke="black" strokeWidth="2" />
      <text x={pad} y={pad} fontSize="12">{`min=${minY.toFixed(2)} max=${maxY.toFixed(2)}`}</text>
    </svg>
  );
}

export default function RunPage({ params }: { params: { runId: string } }) {
  const [results, setResults] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [explain, setExplain] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [equity, setEquity] = useState<any>(null);

  async function load() {
    setMsg("");
    const r = await api.getRunResults(params.runId);
    const t = await api.getTrades(params.runId);
    const eq = await api.getEquity(params.runId);
    setEquity(eq.equity);
    setResults(r);
    setTrades(t);
  }

  useEffect(() => { load().catch(e => setMsg(e.message)); }, [params.runId]);

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
      <a href="/configs">← back to configs</a>

      <h2>Run {params.runId}</h2>
      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {results && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <h3>Metrics</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(results.metrics, null, 2)}</pre>
        </div>
      )}

    {equity && (
    <div style={{ display: "grid", gap: 12 }}>
        <h3>Charts</h3>
        {Object.entries(equity).map(([sym, pts]: any) => (
        <EquityDrawdownChart key={sym} title={`${sym} · Equity & Drawdown`} series={pts} />
        ))}
    </div>
    )}

      <div style={{ display: "grid", gap: 8 }}>
        <h3>Trades</h3>
        {trades.map((t) => (
          <div key={t.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
            <div><b>{t.side}</b> {t.symbol} qty={t.qty.toFixed(4)} price={t.price.toFixed(4)}</div>
            <div>{t.timestamp}</div>
            <div>pnl: {t.pnl.toFixed(4)} fee: {t.fee.toFixed(4)} slip: {t.slippage.toFixed(4)}</div>
            <button onClick={() => explainTrade(t.id)}>Why?</button>
          </div>
        ))}
      </div>

        {explain && (
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <h3>Decision trace</h3>
            <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, marginBottom: 10 }}>
            <b>Summary:</b> {formatDecisionTrace(explain.decision_trace)}
            </div>
            <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(explain, null, 2)}</pre>
        </div>
        )}
    </div>
  );
}