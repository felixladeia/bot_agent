"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";

export default function RunsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const m = await requireMe();
      if (!m) return;
      const rs = await api.listRuns();
      setRuns(rs);
    })().catch(e => setMsg(e.message));
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Runs</h2>
      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {runs.length === 0 ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
          No runs yet. Go to <a href="/configs">Configs</a> and run a backtest.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {runs.map(r => (
            <div key={r.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b>Run #{r.id}</b> · config #{r.config_id} · {r.status}
                  <div style={{ color: "#444" }}>{r.created_at}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a href={`/runs/${r.id}`}>Open</a>
                  <a href={`/compare?run=${r.id}`}>Compare</a>
                </div>
              </div>

              <div style={{ marginTop: 8, display: "grid", gap: 4, color: "#333" }}>
                {"avg_total_return" in r.metrics && <div>avg_total_return: {Number(r.metrics.avg_total_return).toFixed(4)}</div>}
                {"avg_sharpe" in r.metrics && <div>avg_sharpe: {Number(r.metrics.avg_sharpe).toFixed(3)}</div>}
                {"avg_max_drawdown" in r.metrics && <div>avg_max_drawdown: {Number(r.metrics.avg_max_drawdown).toFixed(3)}</div>}
                {"num_trades" in r.metrics && <div>num_trades: {r.metrics.num_trades}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}