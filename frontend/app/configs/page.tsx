"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<any[]>([]);
  const [msg, setMsg] = useState("");

  // simple config form
  const [name, setName] = useState("SMA 10/30 AAPL");
  const [strategy, setStrategy] = useState("sma_crossover");
  const [symbols, setSymbols] = useState("AAPL");
  const [startDate, setStartDate] = useState("2024-01-01");
  const [endDate, setEndDate] = useState("2024-12-31");
  const [paramsJson, setParamsJson] = useState(JSON.stringify({ fast: 10, slow: 30 }, null, 2));
  const [riskJson, setRiskJson] = useState(JSON.stringify({ initial_cash: 10000, risk_fraction: 1.0, fee_bps: 1, slippage_bps: 2, risk_free_rate_annual: 0.04 }, null, 2));
  const [market, setMarket] = useState("crypto");
  const [interval, setInterval] = useState("1h");

  async function refresh() {
    setMsg("");
    const data = await api.listConfigs();
    setConfigs(data);
  }

  useEffect(() => { refresh().catch(e => setMsg(e.message)); }, []);

  async function create() {
    try {
      const payload = {
        name,
        market,
        interval,
        strategy,
        symbols: symbols.split(",").map(s => s.trim()).filter(Boolean),
        start_date: startDate,
        end_date: endDate,
        params: JSON.parse(paramsJson),
        risk: JSON.parse(riskJson),
      };
      await api.createConfig(payload);
      await refresh();
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  async function run(configId: number) {
    try {
      const run = await api.runBacktest(configId);
      window.location.href = `/runs/${run.id}`;
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
        <select value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="crypto">crypto</option>
            <option value="equity">equity</option>
        </select>

        <select value={interval} onChange={(e) => setInterval(e.target.value)}>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1h">1h</option>
            <option value="1d">1d</option>
        </select>
      <h2>Configs</h2>

      <div style={{ display: "grid", gap: 8, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <h3>Create config</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} />
        <select value={strategy} onChange={(e) => setStrategy(e.target.value)}>
          <option value="sma_crossover">sma_crossover</option>
          <option value="rsi_mean_reversion">rsi_mean_reversion</option>
        </select>
        <input value={symbols} onChange={(e) => setSymbols(e.target.value)} placeholder="AAPL,MSFT" />
        <div style={{ display: "flex", gap: 8 }}>
          <input value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <textarea rows={6} value={paramsJson} onChange={(e) => setParamsJson(e.target.value)} />
        <textarea rows={6} value={riskJson} onChange={(e) => setRiskJson(e.target.value)} />
        <button onClick={create}>Create</button>
      </div>

      {msg && <pre style={{ whiteSpace: "pre-wrap" }}>{msg}</pre>}

      <div style={{ display: "grid", gap: 8 }}>
        {configs.map((c) => (
          <div key={c.id} style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
            <b>{c.name}</b>
            <div>strategy: {c.strategy}</div>
            <div>symbols: {c.symbols?.join(", ")}</div>
            <button onClick={() => run(c.id)}>Run backtest</button>
          </div>
        ))}
      </div>
    </div>
  );
}