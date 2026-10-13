// Wat er in de crew gebeurt: wie is nu bezig, wie heeft vandaag getraind, en reacties op jouw trainingen.
import { addDays, dayKey, TZ } from "./dates";
import { DAY_LABEL } from "./schedule";
import type { Workout, WorkoutComment, WorkoutReaction } from "./types";

const hourFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" });

/** "vanochtend", "vanmiddag", "vanavond" (vandaag) of "gisterochtend" enz. */
export function daypart(iso: string, now = new Date()): string {
  const h = Number(hourFmt.format(new Date(iso)));
  const part = h < 12 ? "ochtend" : h < 18 ? "middag" : "avond";
  const k = dayKey(iso);
  if (k === dayKey(now)) return part === "ochtend" ? "vanochtend" : part === "middag" ? "vanmiddag" : "vanavond";
  if (k === addDays(dayKey(now), -1)) return `gister${part}`;
  return "";
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} en ${names.at(-1)}`;
}

/** Trainingen die nu bezig zijn: niet afgerond en gestart in de laatste 3 uur. */
export function activeNow(workouts: Workout[], me: string, now = new Date()): Workout[] {
  const cutoff = now.getTime() - 3 * 3600 * 1000;
  return workouts
    .filter((w) => !w.completed_at && w.user_id !== me && w.day_type !== "cardio" && new Date(w.started_at).getTime() > cutoff)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
}

export interface DoneGroup {
  key: string;
  dayType: Workout["day_type"];
  when: string; // "vanmiddag"
  userIds: string[];
  workoutIds: string[];
  includesMe: boolean;
}

/**
 * Afgeronde trainingen van vandaag en gisteren, gegroepeerd per trainingsdag en dagdeel:
 * "Sem en Jair hebben vanmiddag Upper gedaan".
 */
export function recentDone(workouts: Workout[], me: string, now = new Date()): DoneGroup[] {
  const groups = new Map<string, DoneGroup>();
  const ordered = workouts
    .filter((w) => w.completed_at && !w.quick_check && daypart(w.started_at, now))
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!));
  for (const w of ordered) {
    const when = daypart(w.started_at, now);
    const key = `${w.day_type}:${when}`;
    const g = groups.get(key) ?? { key, dayType: w.day_type, when, userIds: [], workoutIds: [], includesMe: false };
    if (!g.userIds.includes(w.user_id)) g.userIds.push(w.user_id);
    g.workoutIds.push(w.id);
    if (w.user_id === me) g.includesMe = true;
    groups.set(key, g);
  }
  // Alleen groepen waar iemand anders in zit; je eigen solo-training zie je al bovenaan.
  return [...groups.values()].filter((g) => g.userIds.some((u) => u !== me));
}

export function doneSentence(g: DoneGroup, nameOf: (id: string) => string, me: string): string {
  const others = g.userIds.filter((u) => u !== me).map(nameOf);
  const names = g.includesMe ? ["Jij", ...others] : others;
  const verb = names.length > 1 ? "hebben" : g.includesMe ? "hebt" : "heeft";
  const what = g.dayType === "cardio" ? "cardio" : DAY_LABEL[g.dayType];
  return `${joinNames(names)} ${verb} ${g.when} ${what} gedaan`;
}

export interface Notice {
  id: string;
  workoutId: string;
  userIds: string[];
  kind: "reactie" | "comment";
  emojis: string[];
  body?: string;
  at: string;
}

/** Reacties en comments van anderen op jouw trainingen, nieuwste eerst. */
export function noticesFor(
  myWorkouts: Workout[],
  reactions: WorkoutReaction[],
  comments: WorkoutComment[],
  me: string,
  sinceIso: string,
): Notice[] {
  const mine = new Set(myWorkouts.map((w) => w.id));
  const out: Notice[] = [];
  const byWorkout = new Map<string, WorkoutReaction[]>();
  for (const r of reactions) {
    if (!mine.has(r.workout_id) || r.user_id === me || r.created_at < sinceIso) continue;
    byWorkout.set(r.workout_id, [...(byWorkout.get(r.workout_id) ?? []), r]);
  }
  for (const [workoutId, rs] of byWorkout) {
    out.push({
      id: `r-${workoutId}`,
      workoutId,
      userIds: [...new Set(rs.map((r) => r.user_id))],
      kind: "reactie",
      emojis: [...new Set(rs.map((r) => r.emoji))],
      at: rs.map((r) => r.created_at).sort().at(-1)!,
    });
  }
  for (const c of comments) {
    if (!mine.has(c.workout_id) || c.user_id === me || c.created_at < sinceIso) continue;
    out.push({ id: `c-${c.id}`, workoutId: c.workout_id, userIds: [c.user_id], kind: "comment", emojis: [], body: c.body, at: c.created_at });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
