"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setMsg("");
    setLoading(true);
    try {
      const data = mode === "login"
        ? await api.login(email, password)
        : await api.register(email, password);
      setToken(data.access_token);
      window.location.href = "/dashboard";
    } catch (e: any) {
      setMsg(e?.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "70vh" }}>
      <div style={{
        width: 440,
        border: "1px solid #e5e5e5",
        borderRadius: 12,
        padding: 18,
        boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>{mode === "login" ? "Sign in" : "Create account"}</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setMode("login")} disabled={mode === "login"}>Login</button>
            <button onClick={() => setMode("register")} disabled={mode === "register"}>Register</button>
          </div>
        </div>

        <p style={{ marginTop: 6, color: "#444" }}>
          Access your strategies, run backtests, and review trade reasoning.
        </p>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@domain.com"
              autoComplete="email"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span>Password</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>

          <button onClick={submit} disabled={loading || !email || !password}>
            {loading ? "Working..." : (mode === "login" ? "Sign in" : "Create account")}
          </button>

          {msg && (
            <div style={{
              border: "1px solid #f0c2c2",
              background: "#fff5f5",
              padding: 10,
              borderRadius: 10,
              whiteSpace: "pre-wrap"
            }}>
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}