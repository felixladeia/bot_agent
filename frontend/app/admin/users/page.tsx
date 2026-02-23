"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { requireMe } from "@/lib/session";

export default function AdminUsersPage() {
  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const m = await requireMe();
      if (!m) return;
      setMe(m);
      if (!m.is_admin) {
        window.location.href = "/dashboard";
        return;
      }
      const u = await api.listUsers();
      setUsers(u);
    })().catch(e => setMsg(e.message));
  }, []);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Admin · Users</h2>
      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
        <div style={{ marginBottom: 8, color: "#444" }}>
          Registered users ({users.length})
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {users.map(u => (
            <div key={u.id} style={{ padding: 10, border: "1px solid #f0f0f0", borderRadius: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div>
                  <b>#{u.id}</b> {u.email}
                </div>
                <div style={{ color: u.is_admin ? "black" : "#666" }}>
                  {u.is_admin ? "admin" : "user"}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}