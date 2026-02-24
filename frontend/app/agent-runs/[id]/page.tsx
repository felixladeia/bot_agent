"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";

function pretty(o: any) {
  return JSON.stringify(o, null, 2);
}

export default function AgentRunDetailPage() {
  const params = useParams();
  const id = String(params?.id);

  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const m = await requireMe();
    if (!m) return;
    setMe(m);
    const r = await api.getAgentRun(id);
    setData(r);
  }

  // initial load
  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, [id]);

  // poll while running
  useEffect(() => {
    if (!data || data.status !== "running") return;
    const t = setInterval(() => {
      load().catch(() => {});
    }, 2000);
    return () => clearInterval(t);
  }, [data?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const recs = useMemo(() => data?.output?.recommendations ?? [], [data]);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <a href="/agent-runs">← back to agent runs</a>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>Agent Run #{id}</h2>
        <div style={{ color: "#666" }}>
          status: <b>{data?.status ?? "—"}</b>
        </div>
      </div>

      {me && <div style={{ color: "#444" }}>Signed in as <b>{me.email}</b></div>}
      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      {data?.error && (
        <div style={{ padding: 12, border: "1px solid #ffb7b7", borderRadius: 12, background: "#ffecec", color: "#7a0011" }}>
          {data.error}
        </div>
      )}

      {data?.output && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Report</h3>
          {data.output.summary && (
            <div style={{ padding: 10, border: "1px solid #eee", borderRadius: 10, marginBottom: 10 }}>
              <b>Summary:</b> {data.output.summary}
            </div>
          )}

          {recs.length > 0 && (
            <div style={{ display: "grid", gap: 10 }}>
              {recs.map((r: any) => (
                <div key={r.symbol} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 900 }}>{r.symbol}</div>
                    <div>
                      action: <b>{r.action}</b> · confidence: <b>{Number(r.confidence).toFixed(2)}</b>
                    </div>
                  </div>

                  <div style={{ marginTop: 6 }}>{r.rationale}</div>

                  {Array.isArray(r.evidence) && r.evidence.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Evidence</div>
                      <div style={{ display: "grid", gap: 6 }}>
                        {r.evidence.map((e: any, i: number) => (
                          <div key={i} style={{ color: "#444" }}>
                            <b>{e.label}:</b> {String(e.value)}
                            {e.note ? <div style={{ fontSize: 12, color: "#666" }}>{e.note}</div> : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(r.risks) && r.risks.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Risks</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {r.risks.map((x: string, i: number) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  )}

                  {Array.isArray(r.next_steps) && r.next_steps.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Next steps</div>
                      <ul style={{ margin: 0, paddingLeft: 18 }}>
                        {r.next_steps.map((x: string, i: number) => <li key={i}>{x}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: "pointer" }}><b>Raw output JSON</b></summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(data.output)}</pre>
          </details>
        </div>
      )}

      {data?.trace && (
        <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
          <h3 style={{ marginTop: 0 }}>Trace</h3>
          <details open>
            <summary style={{ cursor: "pointer" }}><b>Tool calls</b></summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(data.trace.tool_calls ?? [])}</pre>
          </details>
          <details>
            <summary style={{ cursor: "pointer" }}><b>Full trace JSON</b></summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{pretty(data.trace)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}