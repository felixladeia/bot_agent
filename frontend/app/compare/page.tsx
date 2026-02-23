"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";

function pick(m: any, key: string) {
  const v = m?.[key];
  if (v === undefined || v === null) return "";
  if (typeof v === "number") return v.toFixed(4);
  return String(v);
}

export default function ComparePage() {
  const [runIds, setRunIds] = useState<string[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      await requireMe();
      const qs = new URLSearchParams(window.location.search);
      const ids = qs.getAll("run");
      setRunIds(ids);
      if (ids.length === 0) return;

      const loaded = [];
      for (const id of ids) loaded.push(await api.getRunResults(id));
      setRuns(loaded);
    })().catch(e => setMsg(e.message));
  }, []);

  const keys = useMemo(() => ([
    "avg_total_return",
    "avg_cagr",
    "avg_volatility",
    "avg_sharpe",
    "avg_sortino",
    "avg_max_drawdown",
    "num_trades",
    "round_trips",
    "avg_win_rate",
    "avg_profit_factor",
    "total_realized_pnl",
  ]), []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Compare Runs</h2>
      <div style={{ color: "#444" }}>
        Tip: open <a href="/runs">Runs</a> and click “Compare” on multiple runs to build a URL like <code>?run=12&run=13</code>.
      </div>

      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {runs.length === 0 ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          No runs selected. Add query params like <code>?run=1&run=2</code>.
        </div>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #eee", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>Metric</th>
                {runs.map(r => (
                  <th key={r.id} style={{ textAlign: "left", padding: 10, borderBottom: "1px solid #eee" }}>
                    Run #{r.id}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k}>
                  <td style={{ padding: 10, borderBottom: "1px solid #f4f4f4" }}><b>{k}</b></td>
                  {runs.map(r => (
                    <td key={r.id + "-" + k} style={{ padding: 10, borderBottom: "1px solid #f4f4f4" }}>
                      {pick(r.metrics, k)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}