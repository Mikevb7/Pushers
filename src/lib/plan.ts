import { EXERCISE_MAP } from "./exercises";
import { PLAN, type GymDay, type PlanItem } from "./schedule";
import type { CoachAdvice } from "./types";

export interface PlannedItem extends PlanItem {
  coach?: string; // waarom de coach dit heeft aangepast
}

/** Basisschema + actieve aanpassingen van de coach (weekanalyse eerst, dan advies voor vandaag). */
export function planFor(day: GymDay, advices: CoachAdvice[]): { items: PlannedItem[]; notes: string[] } {
  const items: PlannedItem[] = PLAN[day].items.map((i) => ({ ...i }));
  const notes: string[] = [];
  const weekly = advices.find((a) => a.kind === "weekly");
  const today = advices.find((a) => a.kind === "today" && a.day_type === day);
  for (const advice of [weekly, today]) {
    if (!advice) continue;
    for (const adj of advice.adjustments ?? []) {
      if (adj.day !== day) continue;
      if (adj.type === "note") {
        notes.push(adj.note);
        continue;
      }
      const it = items.find((i) => i.exerciseId === adj.exerciseId);
      if (!it) continue;
      if (adj.type === "add_set") {
        it.sets = Math.min(6, it.sets + 1);
        it.coach = adj.reason ?? "Extra set van de coach";
      } else if (adj.type === "remove_set") {
        it.sets = Math.max(1, it.sets - 1);
        it.coach = adj.reason ?? "Set minder van de coach";
      } else if (adj.type === "swap" && EXERCISE_MAP[adj.toExerciseId]) {
        it.exerciseId = adj.toExerciseId;
        it.coach = adj.reason ?? "Gewisseld door de coach";
      }
    }
  }
  return { items, notes };
}
