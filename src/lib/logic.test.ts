import { describe, expect, it } from "vitest";
import { EXERCISE_MAP, getExercise } from "./exercises";
import { PLAN, ROTATION } from "./schedule";
import { suggest, sessionsFor, type Session } from "./progression";
import { exerciseProgress, exerciseSeries, findPRs, muscleProgress, overallProgress, type DatedSet } from "./stats";
import { consecutiveGymDays, habitStreak, nextGymDay, trainingAdvice, weekStatus, weekStreak } from "./rotation";
import { addDays, weekStart, weekday } from "./dates";
import type { SetRow, Workout } from "./types";

let n = 0;
const set = (p: Partial<SetRow> & { exercise_id: string; weight_kg: number; reps: number }): SetRow => ({
  id: `s${++n}`,
  workout_id: "w1",
  user_id: "u1",
  set_number: 1,
  rir: 1,
  is_drop: false,
  drop_weight_kg: null,
  drop_reps: null,
  created_at: "2026-10-01T10:00:00Z",
  ...p,
});
const sess = (sets: SetRow[], date = "2026-10-01"): Session => ({ workoutId: sets[0]?.workout_id ?? "w", date, sets });
const wo = (day: Workout["day_type"], date: string, completed = true): Workout => ({
  id: `${day}-${date}`,
  user_id: "u1",
  day_type: day,
  started_at: `${date}T10:00:00Z`,
  completed_at: completed ? `${date}T11:00:00Z` : null,
  quick_check: false,
  cardio_description: null,
  cardio_minutes: null,
  notes: null,
});

describe("schema", () => {
  it("alle oefeningen in het schema en alternatieven bestaan", () => {
    for (const day of ROTATION) for (const item of PLAN[day].items) expect(EXERCISE_MAP[item.exerciseId]).toBeTruthy();
    for (const e of Object.values(EXERCISE_MAP)) for (const a of e.alternatives) expect(EXERCISE_MAP[a], `${e.id} -> ${a}`).toBeTruthy();
  });
  it("Smith incline logt zonder stang", () => expect(getExercise("incline-smith").exclBar).toBe(true));
});

describe("progressive overload", () => {
  const item = PLAN.push.items[1]; // chest press 3x 8-12
  const ex = getExercise("chest-press");
  it("eerste keer", () => expect(suggest(item, ex, []).kind).toBe("first"));
  it("alle sets top van de range -> omhoog", () => {
    const s = suggest(item, ex, [sess([1, 2, 3].map((i) => set({ exercise_id: ex.id, weight_kg: 50, reps: 12, set_number: i })))]);
    expect(s.kind).toBe("increase");
    expect(s.weight).toBe(55);
    expect(s.reps).toBe(8);
  });
  it("RIR 3+ op alle sets -> omhoog, ook zonder top reps", () => {
    const s = suggest(item, ex, [sess([1, 2, 3].map((i) => set({ exercise_id: ex.id, weight_kg: 50, reps: 9, rir: 3, set_number: i })))]);
    expect(s.kind).toBe("increase");
  });
  it("niet alles gehaald -> zelfde gewicht, 1 rep meer", () => {
    const s = suggest(item, ex, [sess([12, 10, 9].map((r, i) => set({ exercise_id: ex.id, weight_kg: 50, reps: r, set_number: i + 1 })))]);
    expect(s).toMatchObject({ kind: "hold", weight: 50, reps: 12 });
  });
  it("3x stilstand wordt gemeld", () => {
    const h = [3, 2, 1].map((d) => sess([set({ exercise_id: ex.id, weight_kg: 50, reps: 9, workout_id: `w${d}` })], `2026-10-0${d}`));
    expect(suggest(item, ex, h).kind).toBe("stall");
  });
  it("sessionsFor groepeert en sorteert nieuwste eerst", () => {
    const rows = [
      set({ exercise_id: "chest-press", weight_kg: 40, reps: 10, workout_id: "a" }),
      set({ exercise_id: "chest-press", weight_kg: 45, reps: 10, workout_id: "b" }),
      set({ exercise_id: "pec-deck", weight_kg: 30, reps: 10, workout_id: "b" }),
    ];
    const s = sessionsFor("chest-press", rows, { a: "2026-10-01T10:00:00Z", b: "2026-10-03T10:00:00Z" });
    expect(s.map((x) => x.workoutId)).toEqual(["b", "a"]);
  });
});

describe("stats", () => {
  const mk = (date: string, w: number, reps: number, wid: string, ex = "chest-press"): DatedSet => ({
    ...set({ exercise_id: ex, weight_kg: w, reps, workout_id: wid }),
    date: `${date}T10:00:00Z`,
    created_at: `${date}T10:00:00Z`,
  });
  const sets = [mk("2026-09-01", 50, 10, "a"), mk("2026-09-20", 55, 10, "b"), mk("2026-10-08", 60, 10, "c")];
  it("% sinds start", () => {
    const p = exerciseProgress(exerciseSeries(sets, "chest-press"), "start", "2026-10-09")!;
    expect(Math.round(p)).toBe(20);
  });
  it("% deze week t.o.v. ervoor", () => {
    const p = exerciseProgress(exerciseSeries(sets, "chest-press"), "week", "2026-10-09")!;
    expect(Math.round(p * 10) / 10).toBe(9.1);
  });
  it("spiergroep en totaal", () => {
    expect(muscleProgress(sets, "start", 75, "2026-10-09")[0].muscle).toBe("borst");
    expect(overallProgress(sets, "start", 75, "2026-10-09")).not.toBeNull();
  });
  it("PR's (eerste training telt niet als PR)", () => {
    const prs = findPRs(sets);
    expect(prs.map((p) => p.workoutId)).toEqual(["c", "b"]);
  });
  it("dropsets tellen niet mee", () => {
    const withDrop = [...sets, { ...mk("2026-10-08", 200, 10, "c"), is_drop: true }];
    expect(exerciseSeries(withDrop, "chest-press").at(-1)!.weight).toBe(60);
  });
  it("lichaamsgewicht telt mee bij pull-ups", () => {
    const s = [mk("2026-09-01", 0, 5, "a", "pull-up"), mk("2026-10-01", 0, 8, "b", "pull-up")];
    expect(exerciseProgress(exerciseSeries(s, "pull-up", 80), "start")!).toBeGreaterThan(0);
  });
});

describe("rotatie en streaks", () => {
  it("volgende training", () => {
    expect(nextGymDay([])).toBe("push");
    expect(nextGymDay([wo("push", "2026-10-05"), wo("pull", "2026-10-06")])).toBe("legs");
    expect(nextGymDay([wo("upper", "2026-10-06"), wo("cardio", "2026-10-07")])).toBe("push");
    expect(nextGymDay([wo("push", "2026-10-05"), wo("pull", "2026-10-06", false)])).toBe("pull");
  });
  it("datums", () => {
    expect(weekday("2026-10-05")).toBe(0); // maandag
    expect(weekStart("2026-10-11")).toBe("2026-10-05");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("weekstatus en advies", () => {
    const ws = [wo("push", "2026-10-05"), wo("pull", "2026-10-06"), wo("legs", "2026-10-07"), wo("cardio", "2026-10-08")];
    const st = weekStatus(ws, "2026-10-09");
    expect(st.gymDone).toBe(3);
    expect(st.cardioDone).toBe(true);
    expect(consecutiveGymDays(ws, "2026-10-08")).toBe(3);
    expect(trainingAdvice(ws, "2026-10-08")).toMatch(/rustdag/);
  });
  it("water streak", () => {
    const logs = ["2026-10-07", "2026-10-08"].map((day) => ({ user_id: "u1", day, water_ml: 3000, creatine: true }));
    expect(habitStreak(logs, (l) => l.water_ml >= 3000, "2026-10-09")).toBe(2);
    expect(habitStreak([...logs, { user_id: "u1", day: "2026-10-09", water_ml: 3000, creatine: true }], (l) => l.water_ml >= 3000, "2026-10-09")).toBe(3);
  });
  it("weekstreak", () => {
    const prev = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"].map((d) => wo("push", d));
    expect(weekStreak(prev, "2026-10-09")).toBe(1);
  });
});
