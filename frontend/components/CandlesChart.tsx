"use client";

import React, { useMemo } from "react";
import dynamic from "next/dynamic";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
});

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
  timestamp: string;
  side: "BUY" | "SELL";
  price: number;
  qty: number;
  decision_trace?: any;
};

export function CandlesChart({
  data,
  trades,
  title,
}: {
  data: OhlcRow[];
  trades: Trade[];
  title: string;
}) {
  const { candles, volume, indicators, tradeMarkers } = useMemo(() => {
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
      marker: { opacity: 0.3 },
      yaxis: "y2",
    };

    const indicators: any[] = [];

    if (data.some((d) => d.sma_fast !== undefined)) {
      indicators.push({
        x,
        y: data.map((d) => d.sma_fast),
        type: "scatter",
        mode: "lines",
        name: "SMA Fast",
        line: { width: 2 },
      });
    }

    if (data.some((d) => d.sma_slow !== undefined)) {
      indicators.push({
        x,
        y: data.map((d) => d.sma_slow),
        type: "scatter",
        mode: "lines",
        name: "SMA Slow",
        line: { width: 2 },
      });
    }

    const tradeMarkers = trades.map((t) => ({
      x: [t.timestamp],
      y: [t.price],
      type: "scatter",
      mode: "markers",
      name: t.side,
      marker: {
        size: 10,
        symbol: t.side === "BUY" ? "triangle-up" : "triangle-down",
      },
      hovertemplate: `
        <b>${t.side}</b><br>
        Price: ${t.price.toFixed(2)}<br>
        Qty: ${t.qty.toFixed(4)}<br>
        ${t.decision_trace?.trigger ? `Trigger: ${t.decision_trace.trigger}<br>` : ""}
        Fee: ${t.decision_trace?.fee?.toFixed(2) ?? "-"}<br>
        Slippage: ${t.decision_trace?.slippage?.toFixed(2) ?? "-"}
        <extra></extra>
      `,
    }));

    return { candles, volume, indicators, tradeMarkers };
  }, [data, trades]);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <b>{title}</b>
      </div>

      <Plot
        data={[
          candles,
          volume,
          ...indicators,
          ...tradeMarkers,
        ]}
        layout={{
          dragmode: "zoom",
          hovermode: "x unified",
          xaxis: {
            rangeslider: { visible: false },
            type: "date",
            domain: [0, 1],
          },
          yaxis: {
            title: "Price",
            domain: [0.3, 1],
          },
          yaxis2: {
            title: "Volume",
            domain: [0, 0.25],
          },
          margin: { t: 20, r: 40, l: 50, b: 40 },
          showlegend: true,
        }}
        config={{
          responsive: true,
          displaylogo: false,
        }}
        style={{ width: "100%", height: "520px" }}
      />
    </div>
  );
}