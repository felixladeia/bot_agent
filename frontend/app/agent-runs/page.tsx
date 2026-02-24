"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";

function Badge({ status }: { status: string }) {
  const bg =
    status === "completed" ? "#e8fff0" :
    status === "failed" ? "#ffecec" :
    "#fff7e6";
  const bd =
    status === "completed" ? "#b7f0c8" :
    status === "failed" ? "#ffb7b7" :
    "#ffd39a";

  return (
    <span style={{ background: bg, border: `1px solid ${bd}`, padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>
      {status}
    </span>
  );
}

export default function AgentRunsPage() {
  const [me, setMe] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    setMsg("");
    const m = await requireMe();
    if (!m) return;
    setMe(m);
    const rs = await api.listAgentRuns();
    setRuns(rs);
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <h2 style={{ margin: 0 }}>Agent Runs</h2>
      {me && <div style={{ color: "#444" }}>Signed in as <b>{me.email}</b></div>}
      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {runs.length === 0 ? (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          No agent runs yet.
        </div>
      ) : (
        runs.map((r) => (
          <div key={r.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <a href={`/agent-runs/${r.id}`} style={{ fontWeight: 800 }}>
                  Agent Run #{r.id}
                </a>
                <Badge status={r.status} />
              </div>
              <div style={{ color: "#666", fontSize: 12 }}>{r.created_at}</div>
            </div>

            <div style={{ marginTop: 6, color: "#444" }}>
              config_id: <b>{r.config_id}</b>
            </div>

            {r.summary && (
              <div style={{ marginTop: 6, color: "#333" }}>
                <span style={{ color: "#666" }}>Summary:</span> {r.summary}
              </div>
            )}

            {r.error && (
              <div style={{ marginTop: 6, color: "#b00020" }}>
                Error: {r.error}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}