"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

export interface ChartPoint {
  date: string;
  e1rm: number;
  label: string; // bijv. "50 kg × 10"
}

const short = (d: string) => {
  const [, m, day] = d.split("-");
  return `${Number(day)}/${Number(m)}`;
};

export function ProgressChart({ points }: { points: ChartPoint[] }) {
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-mute">Na twee trainingen met deze oefening zie je hier een lijn.</p>;
  }
  return (
    <div className="h-52 w-full" role="img" aria-label="Geschatte kracht per training">
      <ResponsiveContainer>
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid stroke="#3b4249" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="date" tickFormatter={short} tick={{ fill: "#9aa3ab", fontSize: 12 }} axisLine={false} tickLine={false} minTickGap={20} />
          <YAxis tick={{ fill: "#9aa3ab", fontSize: 12 }} axisLine={false} tickLine={false} domain={["dataMin - 5", "dataMax + 5"]} tickFormatter={(v) => Math.round(v).toString()} />
          <Tooltip
            contentStyle={{ background: "#31373d", border: "none", borderRadius: 8, color: "#eceae4" }}
            labelFormatter={(d) => short(String(d))}
            formatter={(v, _n, item) => [`${(item.payload as ChartPoint).label} (≈ ${Math.round(Number(v))} kg 1RM)`, "Beste set"]}
          />
          <Line type="monotone" dataKey="e1rm" stroke="#ff7a1a" strokeWidth={2.5} dot={{ r: 3, fill: "#ff7a1a" }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
