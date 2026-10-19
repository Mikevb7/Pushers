// Lichaamsgewicht: trendlijn die klopt of je je nu elke dag of eens per maand weegt.
import { addDays, daysBetween } from "./dates";

export interface WeightPoint {
  day: string; // YYYY-MM-DD
  kg: number;
}

/**
 * Trend = gemiddelde van de metingen in de 7 dagen tot en met die dag.
 * Alleen zinvol als je vaak weegt: anders geeft een gemiddelde een vertekend beeld.
 * Geeft null als er te weinig metingen zijn voor een betrouwbare trend.
 */
export function weightTrend(points: WeightPoint[]): WeightPoint[] | null {
  const pts = [...points].sort((a, b) => a.day.localeCompare(b.day));
  if (pts.length < 6) return null;
  // Gemiddeld minstens om de 3 dagen gewogen over de getoonde periode.
  const span = daysBetween(pts[0].day, pts.at(-1)!.day) || 1;
  if (span / (pts.length - 1) > 3) return null;
  return pts.map((p) => {
    const from = addDays(p.day, -6);
    const win = pts.filter((q) => q.day >= from && q.day <= p.day);
    return { day: p.day, kg: Math.round((win.reduce((a, q) => a + q.kg, 0) / win.length) * 10) / 10 };
  });
}

/** Huidig gewicht (trend als die er is, anders laatste meting) en verandering t.o.v. ±30 dagen eerder. */
export function weightSummary(points: WeightPoint[], today: string) {
  const pts = [...points].sort((a, b) => a.day.localeCompare(b.day));
  if (!pts.length) return null;
  const trend = weightTrend(pts);
  const series = trend ?? pts;
  const current = series.at(-1)!;
  // Vergelijk met de meting die het dichtst bij 30 dagen geleden ligt (maar wel ouder dan 2 weken).
  const target = addDays(today, -30);
  const older = series.filter((p) => daysBetween(p.day, current.day) >= 14);
  const base = older.length
    ? older.reduce((a, b) => (Math.abs(daysBetween(b.day, target)) < Math.abs(daysBetween(a.day, target)) ? b : a))
    : null;
  return {
    current: current.kg,
    lastLogged: pts.at(-1)!,
    usesTrend: !!trend,
    change: base ? Math.round((current.kg - base.kg) * 10) / 10 : null,
    changeDays: base ? daysBetween(base.day, current.day) : null,
  };
}

export const RANGES = [
  { id: "1m", label: "1 maand", days: 30 },
  { id: "3m", label: "3 maanden", days: 91 },
  { id: "alles", label: "Alles", days: null },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];
