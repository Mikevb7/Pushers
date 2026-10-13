import type { Reaction } from "./types";

export interface ReactionState {
  counts: Partial<Record<Reaction, number>>;
  mine: Reaction[];
}

export function reactionState(rows: { workout_id: string; user_id: string; emoji: string }[], workoutId: string, me: string): ReactionState {
  const counts: Partial<Record<Reaction, number>> = {};
  const mine: Reaction[] = [];
  for (const r of rows) {
    if (r.workout_id !== workoutId) continue;
    const e = r.emoji as Reaction;
    counts[e] = (counts[e] ?? 0) + 1;
    if (r.user_id === me) mine.push(e);
  }
  return { counts, mine };
}
