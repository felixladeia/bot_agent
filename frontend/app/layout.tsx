"use client";

import { clearToken } from "@/lib/auth";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.me();
        setMe(m);
      } catch {
        // not logged in
      }
    })();
  }, []);

  function logout() {
    clearToken();
    window.location.href = "/login";
  }

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui", padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>Trading Bot MVP</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <a href="/dashboard">Dashboard</a>
            <a href="/runs">Runs</a>
            <a href="/configs">Configs</a>
            {me?.is_admin && <a href="/admin/users">Admin</a>}
            {me ? (
              <>
                <span style={{ color: "#444" }}>{me.email}</span>
                <button onClick={logout}>Logout</button>
              </>
            ) : (
              <a href="/login">Login</a>
            )}
          </div>
        </div>

        <hr style={{ margin: "16px 0" }} />
        {children}
      </body>
    </html>
  );
}