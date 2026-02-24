"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";
import { CandlesChart } from "@/components/CandlesChart";
import { EquityDrawdownChart } from "@/components/EquityDrawdownChart";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 12,
        padding: "10px 12px",
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, color: "#666" }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function fmtPct(x: any) {
  const v = Number(x);
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

function fmtNum(x: any) {
  const v = Number(x);
  if (!Number.isFinite(v)) return "—";
  return v.toFixed(2);
}

export default function DashboardPage() {
  const [me, setMe] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  const [loadingConfigId, setLoadingConfigId] = useState<number | null>(null);

  // preview state
  const [previewRunId, setPreviewRunId] = useState<number | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const m = await requireMe();
      if (!m) return;
      setMe(m);
      const cs = await api.listConfigs();
      setConfigs(cs);
    })().catch((e) => setMsg(e.message));
  }, []);

  async function runAgent(configId: number) {
    try {
        const r = await api.runAgent(configId);
        window.location.href = `/agent-runs/${r.id}`;
    } catch (e: any) {
        setMsg(e.message);
    }
  }

  async function runAndPreview(configId: number) {
    setMsg("");
    setPreview(null);
    setPreviewRunId(null);
    setLoadingConfigId(configId);

    try {
      // 1) kick off backtest
      const run = await api.runBacktest(configId);

      // If api.runBacktest already returns full results, use it.
      // Otherwise, fetch run details by id.
      let runDetail: any = run;

      // Heuristic: if it only has id, fetch details
      if (run && run.id && !run.metrics && !run.equity_curve && !run.trades) {
        // You may need to implement api.getRun(id) depending on your backend.
        runDetail = await api.getRun(run.id);
      }

      setPreviewRunId(runDetail.id ?? run.id ?? null);
      setPreview(runDetail);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoadingConfigId(null);
    }
  }

  const stats = useMemo(() => {
    const m = preview?.metrics ?? preview;
    if (!m) return null;

    return {
      total_return: m.total_return,
      cagr: m.cagr,
      sharpe: m.sharpe,
      max_drawdown: m.max_drawdown,
      num_trades: m.num_trades ?? m.round_trips,
      win_rate: m.win_rate,
      profit_factor: m.profit_factor,
      final_equity: m.final_equity,
    };
  }, [preview]);

  // You’ll need to map your payload fields here.
  // Expecting:
  // preview.ohlcv (array of {timestamp, open, high, low, close, volume, sma_fast?, sma_slow?, rsi?})
  // preview.trades (array)
  // preview.equity_curve (array of {t, equity})
  const ohlcv = preview?.ohlcv ?? preview?.data ?? null;
  const trades = preview?.trades ?? [];
  const equityCurve = preview?.equity_curve ?? [];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0 }}>Dashboard</h2>

      {me && (
        <div style={{ color: "#444" }}>
          Signed in as <b>{me.email}</b> {me.is_admin ? "(admin)" : ""}
        </div>
      )}

      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {/* Configs */}
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h3 style={{ margin: 0 }}>Your configs</h3>
          <a href="/configs">Create / edit →</a>
        </div>

        {configs.length === 0 ? (
          <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
            No configs yet. Go to <a href="/configs">Configs</a> to create one.
          </div>
        ) : (
          configs.map((c) => (
            <div key={c.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <b>{c.name}</b>
                  <div style={{ color: "#444" }}>
                    strategy: {c.strategy} · symbols: {c.symbols?.join(", ")}
                  </div>
                </div>

                <button
                  onClick={() => runAndPreview(c.id)}
                  disabled={loadingConfigId === c.id}
                >
                  {loadingConfigId === c.id ? "Running..." : "Run + preview"}
                </button>
                <button onClick={() => runAgent(c.id)}>Run agent</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h3 style={{ margin: 0 }}>Preview</h3>
            {previewRunId && <a href={`/runs/${previewRunId}`}>Open run →</a>}
          </div>

          {stats && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <Stat label="Total Return" value={fmtPct(stats.total_return)} />
              <Stat label="CAGR" value={fmtPct(stats.cagr)} />
              <Stat label="Sharpe" value={fmtNum(stats.sharpe)} />
              <Stat label="Max Drawdown" value={fmtPct(-Math.abs(Number(stats.max_drawdown ?? 0)))} />
              <Stat label="Trades" value={`${stats.num_trades ?? 0}`} />
              <Stat label="Win Rate" value={fmtPct(stats.win_rate)} />
              <Stat label="Profit Factor" value={stats.profit_factor === Infinity ? "∞" : fmtNum(stats.profit_factor)} />
              <Stat label="Final Equity" value={fmtNum(stats.final_equity)} />
            </div>
          )}

          {ohlcv ? (
            <CandlesChart title="Price + Trades" data={ohlcv} trades={trades} />
          ) : (
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, color: "#666" }}>
              Preview has no OHLCV data. Ensure the run detail endpoint returns candles (timestamp/open/high/low/close/volume).
            </div>
          )}

          {equityCurve?.length ? (
            <EquityDrawdownChart title="Equity & Drawdown" series={equityCurve} />
          ) : (
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12, color: "#666" }}>
              Preview has no equity curve.
            </div>
          )}
        </div>
      )}
    </div>
  );
}