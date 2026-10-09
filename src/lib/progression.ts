// Progressive overload: vaste regels die per oefening het volgende gewicht voorstellen.
import type { Exercise } from "./exercises";
import type { PlanItem } from "./schedule";
import type { SetRow } from "./types";

export interface Session {
  workoutId: string;
  date: string; // ISO
  sets: SetRow[]; // hoofdsets (de dropset hangt eraan als extra info)
}

export type SuggestionKind = "first" | "increase" | "hold" | "stall";

export interface Suggestion {
  kind: SuggestionKind;
  weight: number | null;
  reps: number;
  text: string;
}

const round = (n: number) => Math.round(n * 100) / 100;
const kg = (n: number) => `${round(n).toString().replace(".", ",")} kg`;

/** Groepeer sets van één oefening per training, nieuwste eerst. */
export function sessionsFor(exerciseId: string, sets: SetRow[], workoutDates: Record<string, string>): Session[] {
  const byWorkout = new Map<string, SetRow[]>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue;
    const list = byWorkout.get(s.workout_id) ?? [];
    list.push(s);
    byWorkout.set(s.workout_id, list);
  }
  return [...byWorkout.entries()]
    .map(([workoutId, list]) => ({
      workoutId,
      date: workoutDates[workoutId] ?? list[0].created_at,
      sets: list.sort((a, b) => a.set_number - b.set_number),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function topWeight(sets: SetRow[]): number {
  return Math.max(...sets.map((s) => Number(s.weight_kg)));
}

function bestRepsAt(sets: SetRow[], w: number): number {
  return Math.max(0, ...sets.filter((s) => Number(s.weight_kg) === w).map((s) => s.reps));
}

export function suggest(item: PlanItem, ex: Exercise, history: Session[]): Suggestion {
  const unit = ex.load === "lichaamsgewicht" ? "extra" : ex.exclBar ? "zonder stang" : ex.load === "dumbbell" ? "per dumbbell" : "";
  if (history.length === 0 || history[0].sets.length === 0) {
    return {
      kind: "first",
      weight: null,
      reps: item.repMax - 2,
      text:
        ex.load === "lichaamsgewicht"
          ? `Eerste keer: zoveel mogelijk nette reps, nog 1-2 over.`
          : `Eerste keer: kies een gewicht waarmee je ±${item.repMax - 2} reps haalt en er nog 1-2 over hebt.`,
    };
  }

  const last = history[0].sets;
  const w = topWeight(last);
  const atW = last.filter((s) => Number(s.weight_kg) === w);
  const expected = Math.min(item.sets, last.length);
  const allTop = atW.length >= expected && atW.every((s) => s.reps >= item.repMax);
  const tooEasy = last.every((s) => s.rir !== null && s.rir >= 3) && last.every((s) => s.reps >= item.repMin);

  if (allTop || tooEasy) {
    const next = round(w + ex.increment);
    return {
      kind: "increase",
      weight: next,
      reps: item.repMin,
      text: allTop
        ? `Vorige keer alle sets ${item.repMax}+ reps. Omhoog naar ${kg(next)}${unit ? ` ${unit}` : ""}.`
        : `Vorige keer had je nog 3+ reps over. Omhoog naar ${kg(next)}${unit ? ` ${unit}` : ""}.`,
    };
  }

  const best = bestRepsAt(last, w);
  const target = Math.min(item.repMax, Math.max(item.repMin, best + 1));

  // Stilstand: 3 trainingen hetzelfde gewicht zonder meer reps
  if (history.length >= 3) {
    const recent = history.slice(0, 3);
    const sameWeight = recent.every((h) => h.sets.length && topWeight(h.sets) === w);
    const reps = recent.map((h) => bestRepsAt(h.sets, w));
    if (sameWeight && reps[0] <= reps[2]) {
      return {
        kind: "stall",
        weight: w,
        reps: target,
        text: `Staat al 3 trainingen stil op ${kg(w)}. Ga echt tot 0-1 rep over, of check je slaap en eten.`,
      };
    }
  }

  return {
    kind: "hold",
    weight: w,
    reps: target,
    text: `Blijf op ${kg(w)}${unit ? ` ${unit}` : ""} en ga voor ${target} reps (vorige keer ${best}).`,
  };
}

