// Samenvattingen van trainingen: voor het logboek, de crew-feed, profielen en vergelijken.
import { EXERCISE_MAP } from "./exercises";
import { addDays, dayKey, weekday } from "./dates";
import { e1rm, type DatedSet } from "./stats";
import type { DayType } from "./schedule";
import type { Workout } from "./types";

/** Vaste kleur per trainingsdag, voor kalender en labels. */
export const DAY_COLOR: Record<DayType, string> = {
  push: "#8cc04d",
  pull: "#4f8fd6",
  legs: "#e08a2c",
  upper: "#9b6bd3",
  cardio: "#d9534f",
};

export interface ExerciseSummary {
  exerciseId: string;
  sets: DatedSet[];
  best: DatedSet;
  /** Beste set van de vorige keer dat deze persoon deze oefening deed. */
  prevBest: DatedSet | null;
  /** Verschil in geschatte max t.o.v. de vorige keer, in procent. */
  deltaPct: number | null;
}

export interface WorkoutSummary {
  minutes: number | null;
  setCount: number;
  /** Totaal kg × reps (machines met plaatnummers en lichaamsgewicht tellen niet mee). */
  volume: number;
  exercises: ExerciseSummary[];
}

export function minutesOf(w: Workout): number | null {
  if (!w.completed_at) return null;
  const m = Math.round((new Date(w.completed_at).getTime() - new Date(w.started_at).getTime()) / 60000);
  return m > 0 && m < 600 ? m : null;
}

export function bestSet(sets: DatedSet[], bodyweight = 75): DatedSet | null {
  let best: DatedSet | null = null;
  let bestV = -1;
  for (const s of sets) {
    const ex = EXERCISE_MAP[s.exercise_id];
    if (!ex) continue;
    const v = e1rm(s.weight_kg, s.reps, ex, bodyweight);
    if (v > bestV) {
      bestV = v;
      best = s;
    }
  }
  return best;
}

function value(s: DatedSet, bw: number) {
  const ex = EXERCISE_MAP[s.exercise_id];
  return ex ? e1rm(s.weight_kg, s.reps, ex, bw) : 0;
}

export function volumeOf(sets: DatedSet[]): number {
  return sets.reduce((a, s) => {
    const ex = EXERCISE_MAP[s.exercise_id];
    if (!ex || ex.plates || ex.load === "lichaamsgewicht") return a;
    return a + Number(s.weight_kg) * s.reps;
  }, 0);
}

/**
 * Samenvatting van één training.
 * @param userSets alle sets van de eigenaar (nodig om met de vorige keer te vergelijken)
 */
export function summarize(workout: Workout, userSets: DatedSet[], bodyweight = 75): WorkoutSummary {
  const sets = userSets
    .filter((s) => s.workout_id === workout.id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const order = [...new Set(sets.map((s) => s.exercise_id))];
  const before = userSets.filter((s) => s.workout_id !== workout.id && s.date < workout.started_at);

  const exercises = order.map((exerciseId) => {
    const mine = sets.filter((s) => s.exercise_id === exerciseId).sort((a, b) => a.set_number - b.set_number);
    const best = bestSet(mine, bodyweight)!;
    const earlier = before.filter((s) => s.exercise_id === exerciseId);
    const lastWorkout = earlier.sort((a, b) => b.date.localeCompare(a.date))[0]?.workout_id;
    const prevBest = lastWorkout ? bestSet(earlier.filter((s) => s.workout_id === lastWorkout), bodyweight) : null;
    const deltaPct =
      prevBest && value(prevBest, bodyweight) > 0
        ? Math.round((value(best, bodyweight) / value(prevBest, bodyweight) - 1) * 1000) / 10
        : null;
    return { exerciseId, sets: mine, best, prevBest, deltaPct };
  });

  return { minutes: minutesOf(workout), setCount: sets.length, volume: volumeOf(sets), exercises };
}

/** Kalender: alle dagen van de maand, aangevuld tot hele weken (maandag eerst). */
export function monthGrid(month: string): { key: string; inMonth: boolean }[] {
  const first = `${month}-01`;
  const start = addDays(first, -weekday(first));
  const out: { key: string; inMonth: boolean }[] = [];
  for (let d = start; ; d = addDays(d, 1)) {
    if (d.slice(0, 7) > month && weekday(d) === 0) break;
    out.push({ key: d, inMonth: d.slice(0, 7) === month });
  }
  return out;
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const s = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 1)));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function workoutsByDay(workouts: Workout[]): Map<string, Workout[]> {
  const map = new Map<string, Workout[]>();
  for (const w of workouts) {
    if (!w.completed_at) continue;
    const k = dayKey(w.started_at);
    map.set(k, [...(map.get(k) ?? []), w]);
  }
  return map;
}

export interface CompareRow {
  exerciseId: string;
  mine: DatedSet;
  theirs: DatedSet;
  /** "ik", "zij" of "gelijk", op basis van geschatte max (met lichaamsgewicht meegerekend). */
  winner: "ik" | "zij" | "gelijk";
}

/** Beste set per oefening die jullie allebei gedaan hebben. */
export function compareBest(mine: DatedSet[], theirs: DatedSet[], myBw = 75, theirBw = 75): CompareRow[] {
  const ids = [...new Set(mine.map((s) => s.exercise_id))].filter((id) => theirs.some((s) => s.exercise_id === id));
  return ids
    .map((exerciseId) => {
      const a = bestSet(mine.filter((s) => s.exercise_id === exerciseId), myBw)!;
      const b = bestSet(theirs.filter((s) => s.exercise_id === exerciseId), theirBw)!;
      const va = value(a, myBw);
      const vb = value(b, theirBw);
      const winner: CompareRow["winner"] = Math.abs(va - vb) < 0.5 ? "gelijk" : va > vb ? "ik" : "zij";
      return { exerciseId, mine: a, theirs: b, winner };
    })
    .sort((x, y) => (EXERCISE_MAP[x.exerciseId]?.name ?? "").localeCompare(EXERCISE_MAP[y.exerciseId]?.name ?? ""));
}

/** Per set van de vorige keer: zodat je tijdens het loggen ziet wat je bij set N deed. */
export function lastSessionSets(history: DatedSet[], exerciseId: string): { weight: number; reps: number }[] {
  const rows = history.filter((s) => s.exercise_id === exerciseId);
  if (!rows.length) return [];
  const last = rows.reduce((a, b) => (b.date > a.date ? b : a)).workout_id;
  return rows
    .filter((s) => s.workout_id === last)
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({ weight: Number(s.weight_kg), reps: s.reps }));
}
