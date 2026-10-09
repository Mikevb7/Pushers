// Kracht, progressie in %, PR's en volume.
import { EXERCISE_MAP, type Muscle, type Exercise } from "./exercises";
import { addDays, dayKey } from "./dates";
import type { SetRow } from "./types";

export interface DatedSet extends SetRow {
  date: string; // ISO datum van de training
}

/** Geschatte 1-rep-max (Epley). Bij lichaamsgewicht telt je eigen gewicht mee. */
export function e1rm(weight: number, reps: number, ex: Exercise, bodyweight = 75): number {
  if (reps <= 0) return 0;
  const load = ex.load === "lichaamsgewicht" ? bodyweight + Number(weight) : Number(weight);
  if (load <= 0) return 0;
  return load * (1 + Math.min(reps, 20) / 30);
}

export interface SessionPoint {
  date: string; // YYYY-MM-DD
  workoutId: string;
  e1rm: number;
  weight: number;
  reps: number;
}

/** Beste set per training voor één oefening, oudste eerst. */
export function exerciseSeries(sets: DatedSet[], exerciseId: string, bodyweight = 75): SessionPoint[] {
  const ex = EXERCISE_MAP[exerciseId];
  if (!ex) return [];
  const best = new Map<string, SessionPoint>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId || s.is_drop) continue;
    const v = e1rm(s.weight_kg, s.reps, ex, bodyweight);
    const cur = best.get(s.workout_id);
    if (!cur || v > cur.e1rm) {
      best.set(s.workout_id, { date: dayKey(s.date), workoutId: s.workout_id, e1rm: v, weight: Number(s.weight_kg), reps: s.reps });
    }
  }
  return [...best.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export type Period = "week" | "maand" | "start";

/**
 * Hoeveel % sterker op één oefening.
 * - start: beste van de laatste 2 trainingen t.o.v. de eerste training
 * - week/maand: beste in de periode t.o.v. het beste daarvóór
 */
export function exerciseProgress(series: SessionPoint[], period: Period, today = dayKey()): number | null {
  if (series.length < 2) return null;
  if (period === "start") {
    const base = series[0].e1rm;
    const recent = Math.max(...series.slice(-2).map((p) => p.e1rm));
    return base > 0 ? ((recent - base) / base) * 100 : null;
  }
  const from = addDays(today, period === "week" ? -6 : -29);
  const inside = series.filter((p) => p.date >= from);
  const before = series.filter((p) => p.date < from);
  if (!inside.length || !before.length) return null;
  const base = Math.max(...before.map((p) => p.e1rm));
  const now = Math.max(...inside.map((p) => p.e1rm));
  return base > 0 ? ((now - base) / base) * 100 : null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function exerciseIdsIn(sets: DatedSet[]): string[] {
  return [...new Set(sets.map((s) => s.exercise_id))].filter((id) => EXERCISE_MAP[id]);
}

/** Gemiddelde % per spiergroep (primaire spier van elke oefening). */
export function muscleProgress(sets: DatedSet[], period: Period, bodyweight = 75, today = dayKey()) {
  const groups = new Map<Muscle, number[]>();
  for (const id of exerciseIdsIn(sets)) {
    const p = exerciseProgress(exerciseSeries(sets, id, bodyweight), period, today);
    if (p === null) continue;
    const m = EXERCISE_MAP[id].muscle;
    groups.set(m, [...(groups.get(m) ?? []), p]);
  }
  return [...groups.entries()]
    .map(([muscle, ps]) => ({ muscle, pct: avg(ps)!, exercises: ps.length }))
    .sort((a, b) => b.pct - a.pct);
}

/** Totale % sterker: gemiddelde over alle oefeningen met genoeg data. */
export function overallProgress(sets: DatedSet[], period: Period, bodyweight = 75, today = dayKey()): number | null {
  const ps = exerciseIdsIn(sets)
    .map((id) => exerciseProgress(exerciseSeries(sets, id, bodyweight), period, today))
    .filter((p): p is number => p !== null);
  return avg(ps);
}

export interface PR {
  userId: string;
  exerciseId: string;
  date: string;
  weight: number;
  reps: number;
  workoutId: string;
}

/** Persoonlijke records: een set die zwaarder (geschat 1RM) is dan alles daarvoor. */
export function findPRs(sets: DatedSet[], bodyweightByUser: Record<string, number> = {}): PR[] {
  const sorted = [...sets].filter((s) => !s.is_drop).sort((a, b) => (a.date + a.created_at).localeCompare(b.date + b.created_at));
  const best = new Map<string, number>();
  const firstWorkout = new Map<string, string>();
  const prs = new Map<string, PR>(); // max 1 PR per oefening per training
  for (const s of sorted) {
    const ex = EXERCISE_MAP[s.exercise_id];
    if (!ex) continue;
    const key = `${s.user_id}:${s.exercise_id}`;
    const v = e1rm(s.weight_kg, s.reps, ex, bodyweightByUser[s.user_id] ?? 75);
    if (!firstWorkout.has(key)) firstWorkout.set(key, s.workout_id);
    const prev = best.get(key);
    if (prev !== undefined && v > prev && firstWorkout.get(key) !== s.workout_id) {
      prs.set(`${key}:${s.workout_id}`, {
        userId: s.user_id,
        exerciseId: s.exercise_id,
        date: s.date,
        weight: Number(s.weight_kg),
        reps: s.reps,
        workoutId: s.workout_id,
      });
    }
    if (prev === undefined || v > prev) best.set(key, v);
  }
  return [...prs.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/** Aantal harde sets per spiergroep in de laatste 7 dagen. */
export function weeklySets(sets: DatedSet[], today = dayKey()): Partial<Record<Muscle, number>> {
  const from = addDays(today, -6);
  const out: Partial<Record<Muscle, number>> = {};
  for (const s of sets) {
    if (s.is_drop || dayKey(s.date) < from) continue;
    const ex = EXERCISE_MAP[s.exercise_id];
    if (!ex) continue;
    out[ex.muscle] = (out[ex.muscle] ?? 0) + 1;
  }
  return out;
}

export function formatPct(p: number | null): string {
  if (p === null) return "–";
  const r = Math.round(p * 10) / 10;
  return `${r > 0 ? "+" : ""}${r.toString().replace(".", ",")}%`;
}
