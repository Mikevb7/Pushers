import { describe, expect, it } from "vitest";
import { compareBest, completion, lastSessionSets, monthGrid, shiftMonth, summarize, volumeOf } from "./history";
import type { DatedSet } from "./stats";
import type { Workout } from "./types";

let n = 0;
const s = (workout_id: string, date: string, exercise_id: string, set_number: number, weight_kg: number, reps: number, user_id = "u1"): DatedSet => ({
  id: `s${++n}`,
  workout_id,
  user_id,
  exercise_id,
  set_number,
  weight_kg,
  reps,
  rir: 1,
  is_drop: false,
  drop_weight_kg: null,
  drop_reps: null,
  created_at: `${date}T10:0${set_number}:00Z`,
  date: `${date}T10:00:00Z`,
});
const w = (id: string, date: string, minutes = 60): Workout => ({
  id,
  user_id: "u1",
  day_type: "push",
  started_at: `${date}T10:00:00Z`,
  completed_at: new Date(new Date(`${date}T10:00:00Z`).getTime() + minutes * 60000).toISOString(),
  quick_check: false,
  cardio_description: null,
  cardio_minutes: null,
  notes: null,
});

describe("trainingsoverzicht", () => {
  const sets = [
    s("w1", "2026-10-01", "chest-press", 1, 50, 10),
    s("w1", "2026-10-01", "chest-press", 2, 50, 8),
    s("w2", "2026-10-05", "chest-press", 1, 55, 10),
    s("w2", "2026-10-05", "chest-press", 2, 55, 9),
    s("w2", "2026-10-05", "pull-up", 1, 0, 8),
  ];
  it("vat een training samen met vergelijking met de vorige keer", () => {
    const sum = summarize(w("w2", "2026-10-05", 72), sets);
    expect(sum.minutes).toBe(72);
    expect(sum.setCount).toBe(3);
    expect(sum.volume).toBe(55 * 10 + 55 * 9); // pull-ups (lichaamsgewicht) tellen niet mee
    const cp = sum.exercises.find((e) => e.exerciseId === "chest-press")!;
    expect(cp.best.weight_kg).toBe(55);
    expect(cp.prevBest?.weight_kg).toBe(50);
    expect(cp.deltaPct).toBe(10);
    expect(sum.exercises.find((e) => e.exerciseId === "pull-up")!.prevBest).toBeNull();
  });
  it("vorige keer per set", () => {
    expect(lastSessionSets(sets, "chest-press")).toEqual([
      { weight: 55, reps: 10 },
      { weight: 55, reps: 9 },
    ]);
    expect(lastSessionSets(sets, "leg-press")).toEqual([]);
  });
  it("volume", () => {
    expect(volumeOf([s("w", "2026-10-01", "chest-press", 1, 40, 10)])).toBe(400);
  });
  it("vergelijken: beste set op gedeelde oefeningen", () => {
    const theirs = [s("x", "2026-10-02", "chest-press", 1, 60, 6, "u2"), s("x", "2026-10-02", "leg-press", 1, 100, 10, "u2")];
    const rows = compareBest(sets, theirs);
    expect(rows).toHaveLength(1);
    expect(rows[0].mine.weight_kg).toBe(55);
    // 55×10 ≈ 73,3 vs 60×6 = 72 → ik
    expect(rows[0].winner).toBe("ik");
  });
});

describe("kalender", () => {
  it("oktober 2026 begint op donderdag, grid start op maandag 28 sep", () => {
    const g = monthGrid("2026-10");
    expect(g[0].key).toBe("2026-09-28");
    expect(g.length % 7).toBe(0);
    expect(g.filter((d) => d.inMonth)).toHaveLength(31);
  });
  it("maand verschuiven", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("afgemaakt-percentage", () => {
  it("telt sets per oefening tot het plan, varianten tellen mee, extra sets niet", () => {
    const wk = { ...w("x", "2026-10-20"), day_type: "push" as const };
    const sets = [
      ...[1, 2, 3, 4].map((i) => s("x", "2026-10-20", "incline-smith", i, 40, 8)), // 4 sets, plan 3 → 3
      ...[1, 2, 3].map((i) => s("x", "2026-10-20", "cable-lateral-wit", i, 2, 12)), // variant telt
    ];
    const c = completion(wk, sets)!;
    const planned = 3 + 3 + 3 + 3 + 3 + 3 + 2;
    expect(c.planned).toBe(planned);
    expect(c.done).toBe(6);
    expect(c.pct).toBe(Math.round((6 / planned) * 100));
    expect(c.missing.map((m) => m.exerciseId)).toContain("chest-press");
    expect(c.missing.map((m) => m.exerciseId)).not.toContain("cable-lateral");
  });
});
