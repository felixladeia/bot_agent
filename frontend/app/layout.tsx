"use client";

import { clearToken } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <a
      href={href}
      style={{
        textDecoration: "none",
        padding: "8px 10px",
        borderRadius: 10,
        color: active ? "#111" : "#444",
        background: active ? "rgba(0,0,0,0.06)" : "transparent",
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </a>
  );
}

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
      <body
        style={{
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji",
          margin: 0,
          background: "#fafafa",
          color: "#111",
        }}
      >
        {/* minimal global styles */}
        <style>{`
          a { color: inherit; }
          button {
            border: 1px solid #ddd;
            background: white;
            padding: 8px 10px;
            border-radius: 10px;
            cursor: pointer;
          }
          button:hover { background: #f5f5f5; }
          hr { border: none; border-top: 1px solid #e5e7eb; }
        `}</style>

        <div style={{ maxWidth: 1200, margin: "0 auto", padding: 20 }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 22 }}>Trading Bot</h1>
              <span style={{ fontSize: 12, color: "#666" }}>
                backtests • indicators • runs
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <NavLink href="/dashboard" label="Dashboard" />
              <NavLink href="/runs" label="Runs" />
              <NavLink href="/configs" label="Configs" />
              <NavLink href="/agent-runs" label="Agent Runs" />
              {me?.is_admin && <NavLink href="/admin/users" label="Admin" />}

              <div style={{ width: 1, height: 22, background: "#e5e7eb", margin: "0 6px" }} />

              {me ? (
                <>
                  <span style={{ color: "#444", fontSize: 12 }}>{me.email}</span>
                  <button onClick={logout}>Logout</button>
                </>
              ) : (
                <NavLink href="/login" label="Login" />
              )}
            </div>
          </div>

          <hr style={{ margin: "16px 0" }} />

          {/* Main content */}
          <div
            style={{
              background: "white",
              border: "1px solid #eee",
              borderRadius: 14,
              padding: 16,
              boxShadow: "0 10px 30px rgba(0,0,0,0.04)",
            }}
          >
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}