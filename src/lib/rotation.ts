// Welke training is de volgende, weekoverzicht en streaks.
import { DAY_LABEL, ROTATION, GYM_SESSIONS_PER_WEEK, type GymDay } from "./schedule";
import { addDays, dayKey, weekStart } from "./dates";
import type { HabitLog, Workout } from "./types";

const isGym = (w: Workout) => w.day_type !== "cardio";
const done = (ws: Workout[]) => ws.filter((w) => w.completed_at);

/** Volgende training in de rotatie, op basis van de laatst afgeronde gymtraining. */
export function nextGymDay(workouts: Workout[]): GymDay {
  const last = done(workouts)
    .filter(isGym)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
  if (!last) return "push";
  const i = ROTATION.indexOf(last.day_type as GymDay);
  return ROTATION[(i + 1) % ROTATION.length];
}

export interface WeekStatus {
  start: string;
  days: { key: string; workouts: Workout[] }[];
  gymDone: number;
  cardioDone: boolean;
  gymLeft: number;
}

export function weekStatus(workouts: Workout[], today = dayKey()): WeekStatus {
  const start = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => {
    const key = addDays(start, i);
    return { key, workouts: done(workouts).filter((w) => dayKey(w.started_at) === key) };
  });
  const all = days.flatMap((d) => d.workouts);
  const gymDone = all.filter(isGym).length;
  return {
    start,
    days,
    gymDone,
    cardioDone: all.some((w) => w.day_type === "cardio"),
    gymLeft: Math.max(0, GYM_SESSIONS_PER_WEEK - gymDone),
  };
}

/** Hoeveel dagen achter elkaar gegymd, tot en met vandaag (of gisteren). */
export function consecutiveGymDays(workouts: Workout[], today = dayKey()): number {
  const days = new Set(done(workouts).filter(isGym).map((w) => dayKey(w.started_at)));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// Spiergroepen per trainingsdag, voor het rustadvies. Buik zit er bewust niet in:
// die herstelt snel en zit in zowel Legs als Upper.
const DAY_MUSCLES: Record<GymDay, string[]> = {
  push: ["borst", "schouders", "triceps"],
  pull: ["rug", "biceps"],
  legs: ["benen", "billen"],
  upper: ["borst", "rug", "schouders", "biceps", "triceps"],
};

function joinNl(xs: string[]): string {
  return xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} en ${xs[xs.length - 1]}`;
}

/** Per spiergroep van de volgende training: hoeveel dagen geleden die voor het laatst gewerkt heeft. */
function muscleRest(workouts: Workout[], next: GymDay, today: string): Map<string, number> {
  const rest = new Map<string, number>();
  for (const back of [1, 2]) {
    const key = addDays(today, -back);
    for (const w of done(workouts).filter(isGym)) {
      if (dayKey(w.started_at) !== key) continue;
      for (const m of DAY_MUSCLES[w.day_type as GymDay] ?? []) {
        if (DAY_MUSCLES[next].includes(m) && !rest.has(m)) rest.set(m, back);
      }
    }
  }
  return rest;
}

/**
 * Rustadvies voor vandaag. Kijkt naar welke spieren de volgende training raakt
 * en wanneer die voor het laatst gewerkt hebben, niet alleen naar het aantal dagen op rij.
 */
export function trainingAdvice(workouts: Workout[], today = dayKey()): string | null {
  const week = weekStatus(workouts, today);
  const trainedToday = week.days.find((d) => d.key === today)?.workouts.some(isGym);
  if (trainedToday) return null;
  if (week.gymDone >= GYM_SESSIONS_PER_WEEK) return "Je 4 gymtrainingen zitten erin. Rust, of doe je cardio.";

  const next = nextGymDay(workouts);
  const label = DAY_LABEL[next];
  const streak = consecutiveGymDays(workouts, today);
  const rest = muscleRest(workouts, next, today);
  const yesterday = [...rest].filter(([, d]) => d === 1).map(([m]) => m);
  const twoDays = [...rest].filter(([, d]) => d === 2).map(([m]) => m);

  if (streak >= 4) return `Je hebt ${streak} dagen achter elkaar getraind. Neem vandaag rust, dan kom je sterker terug.`;
  if (yesterday.length)
    return `Je ${joinNl(yesterday)} ${yesterday.length > 1 ? "hebben" : "heeft"} gisteren al gewerkt. Rust vandaag of doe cardio, en doe ${label} morgen.`;
  if (streak >= 3) {
    const extra = twoDays.length
      ? `Je ${joinNl(twoDays)} ${twoDays.length > 1 ? "hebben" : "heeft"} pas 2 dagen rust, dus voel je je moe, wacht dan een dag.`
      : "De spieren van vandaag zijn uitgerust.";
    return `${streak} dagen op rij getraind. ${label} kan vandaag: ${extra} Plan morgen wel een rustdag.`;
  }
  return null;
}

/** Streak: aantal dagen achter elkaar dat het doel is gehaald (vandaag telt mee als het al gehaald is). */
export function habitStreak(logs: HabitLog[], ok: (l: HabitLog) => boolean, today = dayKey()): number {
  const good = new Set(logs.filter(ok).map((l) => l.day));
  let d = good.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (good.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** Weken achter elkaar met 4 gymtrainingen. De huidige week telt mee zodra hij vol is. */
export function weekStreak(workouts: Workout[], today = dayKey()): number {
  const counts = new Map<string, number>();
  for (const w of done(workouts).filter(isGym)) {
    const k = weekStart(dayKey(w.started_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const full = (k: string) => (counts.get(k) ?? 0) >= GYM_SESSIONS_PER_WEEK;
  let k = weekStart(today);
  if (!full(k)) k = addDays(k, -7);
  let n = 0;
  while (full(k)) {
    n++;
    k = addDays(k, -7);
  }
  return n;
}
