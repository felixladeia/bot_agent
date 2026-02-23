"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

type Point = { t: string; equity: number };

type ChartPoint = {
  t: number;          // epoch ms
  tLabel: string;     // formatted for tooltip
  equity: number;
  drawdown: number;   // negative fraction, e.g. -0.123
};

function parseTimeMs(t: string): number {
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : 0;
}

function formatDateTime(ms: number): string {
  if (!ms) return "";
  return new Date(ms).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtUSD(v: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

function fmtPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

function buildSeries(points: Point[]): ChartPoint[] {
  // 1) parse + filter bad points
  const parsed = points
    .map((p) => ({
      t: parseTimeMs(p.t),
      equity: Number.isFinite(p.equity) ? p.equity : NaN,
    }))
    .filter((p) => p.t > 0 && Number.isFinite(p.equity));

  // 2) sort
  parsed.sort((a, b) => a.t - b.t);

  // 3) dedupe by timestamp (keep last)
  const dedup: { t: number; equity: number }[] = [];
  for (const p of parsed) {
    const last = dedup[dedup.length - 1];
    if (last && last.t === p.t) {
      last.equity = p.equity;
    } else {
      dedup.push({ ...p });
    }
  }

  // 4) compute drawdown
  let peak = -Infinity;
  return dedup.map((p) => {
    peak = Math.max(peak, p.equity);
    const dd = peak > 0 ? p.equity / peak - 1 : 0;
    return {
      t: p.t,
      tLabel: formatDateTime(p.t),
      equity: p.equity,
      drawdown: dd,
    };
  });
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  // payload contains entries for equity & drawdown
  const byKey = new Map<string, any>();
  for (const item of payload) {
    if (item?.dataKey) byKey.set(item.dataKey, item);
  }

  const point: ChartPoint | undefined = payload[0]?.payload;
  const equity = point?.equity ?? 0;
  const drawdown = point?.drawdown ?? 0;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 10,
        padding: 10,
        boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        {point?.tLabel ?? ""}
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Equity:</span>
        <span>{fmtUSD(equity)}</span>
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Drawdown:</span>
        <span>{fmtPct(drawdown)}</span>
      </div>
    </div>
  );
}

export function EquityDrawdownChart({
  series,
  title,
}: {
  series: Point[];
  title: string;
}) {
  const data = useMemo(() => buildSeries(series), [series]);

  // helpful guard: avoid rendering empty chart layout
  if (!data.length) {
    return (
      <div style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <b>{title}</b>
        </div>
        <div style={{ fontSize: 13, color: "#666" }}>
          No equity points to display.
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <b>{title}</b>
      </div>

      <div style={{ width: "100%", height: 320 }}>
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 12 }}
              minTickGap={24}
              tickFormatter={(ms) => {
                // shorter ticks than tooltip
                const d = new Date(ms);
                return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
              }}
            />

            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => fmtUSD(v)}
              width={88}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => fmtPct(v)}
              domain={[-1, 0]}
              width={64}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Drawdown as filled area */}
            <ReferenceLine yAxisId="right" y={0} strokeDasharray="4 4" />
            <Area
              yAxisId="right"
              type="monotone"
              dataKey="drawdown"
              name="Drawdown"
              strokeWidth={2}
              fillOpacity={0.15}
              dot={false}
              isAnimationActive={false}
            />

            {/* Equity line */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="equity"
              name="Equity"
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}