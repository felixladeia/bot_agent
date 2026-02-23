"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

type OhlcRow = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  sma_fast?: number;
  sma_slow?: number;
  rsi?: number;
};

type Trade = {
  id?: number;
  timestamp: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  pnl?: number;
  fee?: number;
  slippage?: number;
};

function buildBuyHoldEquity(data: OhlcRow[], initialCash: number) {
  if (!data.length) return [];
  const entry = data[0].close;
  const qty = entry > 0 ? initialCash / entry : 0;
  return data.map((d) => ({ t: d.timestamp, equity: qty * d.close }));
}

function buildDrawdown(series: { t: string; equity: number }[]) {
  let peak = -Infinity;
  return series.map((p) => {
    peak = Math.max(peak, p.equity);
    const dd = peak > 0 ? p.equity / peak - 1 : 0;
    return { t: p.t, drawdown: dd };
  });
}

function buildPositionIntervals(trades: Trade[]) {
  const sorted = [...trades].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const intervals: { start: string; end: string }[] = [];
  let open: string | null = null;

  for (const t of sorted) {
    if (t.side === "BUY" && !open) open = t.timestamp;
    if (t.side === "SELL" && open) {
      intervals.push({ start: open, end: t.timestamp });
      open = null;
    }
  }
  return intervals;
}

export function BacktestOverviewChart({
  title,
  data,
  trades,
  equityCurve,
  initialCash,
}: {
  title: string;
  data: OhlcRow[];
  trades: Trade[];
  equityCurve: { t: string; equity: number }[];
  initialCash: number;
}) {
  const prepared = useMemo(() => {
    const x = data.map((d) => d.timestamp);

    const candles = {
      x,
      open: data.map((d) => d.open),
      high: data.map((d) => d.high),
      low: data.map((d) => d.low),
      close: data.map((d) => d.close),
      type: "candlestick",
      name: "Price",
      xaxis: "x",
      yaxis: "y",
    };

    const volume = {
      x,
      y: data.map((d) => d.volume ?? 0),
      type: "bar",
      name: "Volume",
      xaxis: "x2",
      yaxis: "y2",
      marker: { opacity: 0.25 },
      hovertemplate: "Volume: %{y}<extra></extra>",
    };

    const traces: any[] = [candles, volume];

    if (data.some((d) => d.sma_fast != null)) {
      traces.push({
        x,
        y: data.map((d) => (d.sma_fast ?? null)),
        type: "scatter",
        mode: "lines",
        name: "SMA Fast",
        xaxis: "x",
        yaxis: "y",
        line: { width: 2 },
        hovertemplate: "SMA Fast: %{y:.2f}<extra></extra>",
      });
    }
    if (data.some((d) => d.sma_slow != null)) {
      traces.push({
        x,
        y: data.map((d) => (d.sma_slow ?? null)),
        type: "scatter",
        mode: "lines",
        name: "SMA Slow",
        xaxis: "x",
        yaxis: "y",
        line: { width: 2 },
        hovertemplate: "SMA Slow: %{y:.2f}<extra></extra>",
      });
    }

    // Trade markers
    for (const t of trades) {
      traces.push({
        x: [t.timestamp],
        y: [t.price],
        type: "scatter",
        mode: "markers",
        name: t.side,
        xaxis: "x",
        yaxis: "y",
        marker: {
          size: 11,
          symbol: t.side === "BUY" ? "triangle-up" : "triangle-down",
          line: { width: 1 },
        },
        hovertemplate:
          `<b>${t.side}</b><br>` +
          `Time: ${t.timestamp}<br>` +
          `Price: ${Number(t.price).toFixed(2)}<br>` +
          `Qty: ${Number(t.qty).toFixed(4)}<br>` +
          (t.fee != null ? `Fee: ${Number(t.fee).toFixed(2)}<br>` : "") +
          (t.slippage != null ? `Slippage: ${Number(t.slippage).toFixed(4)}<br>` : "") +
          (t.pnl != null ? `PnL: ${Number(t.pnl).toFixed(2)}<br>` : "") +
          `<extra></extra>`,
      });
    }

    // Equity comparison
    const stratEq = equityCurve?.length ? equityCurve : data.map((d) => ({ t: d.timestamp, equity: initialCash }));
    const bhEq = buildBuyHoldEquity(data, initialCash);

    traces.push({
      x: stratEq.map((p) => p.t),
      y: stratEq.map((p) => p.equity),
      type: "scatter",
      mode: "lines",
      name: "Equity (Strategy)",
      xaxis: "x3",
      yaxis: "y3",
      line: { width: 2 },
      hovertemplate: "Strategy: %{y:.2f}<extra></extra>",
    });
    traces.push({
      x: bhEq.map((p) => p.t),
      y: bhEq.map((p) => p.equity),
      type: "scatter",
      mode: "lines",
      name: "Equity (Buy & Hold)",
      xaxis: "x3",
      yaxis: "y3",
      line: { width: 2, dash: "dot" },
      hovertemplate: "B&H: %{y:.2f}<extra></extra>",
    });

    const stratDd = buildDrawdown(stratEq);
    const bhDd = buildDrawdown(bhEq);

    traces.push({
      x: stratDd.map((p) => p.t),
      y: stratDd.map((p) => p.drawdown),
      type: "scatter",
      mode: "lines",
      name: "Drawdown (Strategy)",
      xaxis: "x4",
      yaxis: "y4",
      fill: "tozeroy",
      fillcolor: "rgba(0,0,0,0.10)",
      line: { width: 1.8 },
      hovertemplate: "DD: %{y:.2%}<extra></extra>",
    });
    traces.push({
      x: bhDd.map((p) => p.t),
      y: bhDd.map((p) => p.drawdown),
      type: "scatter",
      mode: "lines",
      name: "Drawdown (B&H)",
      xaxis: "x4",
      yaxis: "y4",
      fill: "tozeroy",
      fillcolor: "rgba(0,0,0,0.05)",
      line: { width: 1.6, dash: "dot" },
      hovertemplate: "DD: %{y:.2%}<extra></extra>",
    });

    // Position shading (top panel)
    const intervals = buildPositionIntervals(trades);
    const shapes = intervals.map((iv) => ({
      type: "rect",
      xref: "x",
      yref: "paper",
      x0: iv.start,
      x1: iv.end,
      y0: 0.62,
      y1: 1.0,
      fillcolor: "rgba(0, 0, 0, 0.06)",
      line: { width: 0 },
      layer: "below",
    }));

    return { traces, shapes };
  }, [data, trades, equityCurve, initialCash]);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <b>{title}</b>
      </div>

      <Plot
        data={prepared.traces}
        layout={{
          hovermode: "x unified",
          dragmode: "zoom",
          showlegend: true,
          legend: { orientation: "h", y: 1.05 },
          margin: { t: 30, r: 40, l: 55, b: 40 },

          grid: { rows: 4, columns: 1, pattern: "independent" },

          xaxis: { type: "date", rangeslider: { visible: false } },
          yaxis: { title: "Price", domain: [0.62, 1.0] },

          xaxis2: { type: "date" },
          yaxis2: { title: "Volume", domain: [0.46, 0.60] },

          xaxis3: { type: "date" },
          yaxis3: { title: "Equity", domain: [0.23, 0.44] },

          xaxis4: { type: "date" },
          yaxis4: { title: "Drawdown", domain: [0.0, 0.20], tickformat: ".0%", range: [-0.8, 0] },

          shapes: prepared.shapes,
        }}
        config={{ responsive: true, displaylogo: false }}
        style={{ width: "100%", height: "760px" }}
      />
    </div>
  );
}