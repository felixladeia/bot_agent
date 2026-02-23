"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";

export default function DashboardPage() {
  const [me, setMe] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const m = await requireMe();
      if (!m) return;
      setMe(m);
      const cs = await api.listConfigs();
      setConfigs(cs);
    })().catch(e => setMsg(e.message));
  }, []);

  async function run(configId: number) {
    try {
      const run = await api.runBacktest(configId);
      window.location.href = `/runs/${run.id}`;
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0 }}>Dashboard</h2>
      {me && (
        <div style={{ color: "#444" }}>
          Signed in as <b>{me.email}</b> {me.is_admin ? "(admin)" : ""}
        </div>
      )}

      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

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
          configs.map(c => (
            <div key={c.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b>{c.name}</b>
                  <div style={{ color: "#444" }}>
                    strategy: {c.strategy} · symbols: {c.symbols?.join(", ")}
                  </div>
                </div>
                <button onClick={() => run(c.id)}>Run backtest</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}