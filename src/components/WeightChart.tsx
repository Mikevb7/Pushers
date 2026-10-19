"use client";

import { useState } from "react";

interface Point {
  day: string; // YYYY-MM-DD
  kg: number;
}

const W = 340;
const H = 190;
const PAD = { l: 34, r: 12, t: 14, b: 26 };
const t = (day: string) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
const fmtKg = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");
const fmtDay = (day: string) =>
  new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(t(day)));

/**
 * Gewichtsgrafiek met een échte tijd-as: punten staan zo ver uit elkaar als de dagen ertussen.
 * Met een trendlijn (vaak gewogen) zijn de losse metingen lichte puntjes; zonder trend
 * worden de metingen gewoon met een lijn verbonden.
 */
export function WeightChart({ points, trend, from, to }: { points: Point[]; trend: Point[] | null; from: string; to: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return null;

  const x0 = t(from);
  const x1 = Math.max(t(to), x0 + 86400000);
  const all = [...points, ...(trend ?? [])].map((p) => p.kg);
  const lo = Math.floor(Math.min(...all) - 0.8);
  const hi = Math.ceil(Math.max(...all) + 0.8);
  const x = (day: string) => PAD.l + ((t(day) - x0) / (x1 - x0)) * (W - PAD.l - PAD.r);
  const y = (kg: number) => PAD.t + ((hi - kg) / (hi - lo)) * (H - PAD.t - PAD.b);

  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);

  const line = (ps: Point[]) => ps.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const shown = hover !== null ? points[hover] : null;
  const shownTrend = shown && trend ? trend.find((p) => p.day === shown.day) : null;

  function pick(clientX: number, rect: DOMRect) {
    const px = ((clientX - rect.left) / rect.width) * W;
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(x(p.day) - px) < Math.abs(x(points[best].day) - px)) best = i;
    });
    setHover(best);
  }

  return (
    <figure className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`Gewicht van ${fmtDay(points[0].day)} tot ${fmtDay(points.at(-1)!.day)}: van ${fmtKg(points[0].kg)} naar ${fmtKg(points.at(-1)!.kg)} kg`}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerMove={(e) => (e.buttons || e.pointerType === "mouse") && pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize={11} fill="var(--color-mute)">
              {v}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize={11} fill="var(--color-mute)">
          {fmtDay(from)}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" fontSize={11} fill="var(--color-mute)">
          {fmtDay(to)}
        </text>

        {trend ? (
          <>
            {points.map((p) => (
              <circle key={p.day} cx={x(p.day)} cy={y(p.kg)} r={3} fill="var(--color-pin)" opacity={0.35} />
            ))}
            <path d={line(trend)} fill="none" stroke="var(--color-pin-deep)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          </>
        ) : (
          <>
            {points.length > 1 && <path d={line(points)} fill="none" stroke="var(--color-pin)" strokeWidth={2} strokeLinejoin="round" />}
            {points.map((p) => (
              <circle key={p.day} cx={x(p.day)} cy={y(p.kg)} r={4.5} fill="var(--color-pin-deep)" stroke="var(--color-steel)" strokeWidth={2} />
            ))}
          </>
        )}

        {shown && (
          <>
            <line x1={x(shown.day)} x2={x(shown.day)} y1={PAD.t} y2={H - PAD.b} stroke="var(--color-mute)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(shown.day)} cy={y(shown.kg)} r={5} fill="var(--color-chalk)" stroke="var(--color-steel)" strokeWidth={2} />
          </>
        )}
      </svg>
      {shown && (
        <figcaption
          className="pointer-events-none absolute top-0 rounded-lg bg-chalk px-2.5 py-1.5 text-xs text-floor shadow"
          style={{ left: `clamp(0px, calc(${(x(shown.day) / W) * 100}% - 50px), calc(100% - 110px))` }}
        >
          <span className="font-semibold">{fmtKg(shown.kg)} kg</span> · {fmtDay(shown.day)}
          {shownTrend && <span className="block opacity-80">trend {fmtKg(shownTrend.kg)} kg</span>}
        </figcaption>
      )}
    </figure>
  );
}
