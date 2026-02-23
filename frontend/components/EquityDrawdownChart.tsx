"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Point = { t: string; equity: number };

function buildDrawdown(points: Point[]) {
  let peak = -Infinity;
  return points.map(p => {
    peak = Math.max(peak, p.equity);
    const dd = peak > 0 ? (p.equity / peak - 1) : 0;
    return { ...p, drawdown: dd };
  });
}

export function EquityDrawdownChart({ series, title }: { series: Point[]; title: string }) {
  const data = useMemo(() => buildDrawdown(series), [series]);

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
      <div style={{ marginBottom: 8 }}><b>{title}</b></div>

      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tick={{ fontSize: 12 }} minTickGap={18} />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="equity" dot={false} strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="drawdown" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}