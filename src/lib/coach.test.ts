import { describe, expect, it } from "vitest";
import { buildCoachContext, sanitizeAdjustments } from "./coach";
import { planFor } from "./plan";

describe("coach", () => {
  it("laat alleen geldige aanpassingen door, max 3 per dag", () => {
    const out = sanitizeAdjustments([
      { type: "add_set", day: "pull", exerciseId: "lat-pulldown", reason: "rug blijft achter" },
      { type: "swap", day: "pull", exerciseId: "evolve-mid-row", toExerciseId: "one-arm-db-row" },
      { type: "swap", day: "pull", exerciseId: "evolve-mid-row", toExerciseId: "bestaat-niet" },
      { type: "add_set", day: "push", exerciseId: "lat-pulldown" }, // niet in push
      { type: "note", day: "pull", note: "Focus op tempo" },
      { type: "add_set", day: "pull", exerciseId: "rear-delt-fly" }, // 4e voor pull
      { type: "rm -rf", day: "pull" },
    ]);
    expect(out.map((a) => a.type)).toEqual(["add_set", "swap", "note"]);
  });
  it("planFor past sets en wissels toe", () => {
    const adv = [{ id: "a", user_id: "u", created_at: "", kind: "weekly" as const, day_type: null, summary: "", valid_until: "2099-01-01",
      adjustments: sanitizeAdjustments([{ type: "add_set", day: "pull", exerciseId: "lat-pulldown" }, { type: "swap", day: "pull", exerciseId: "evolve-mid-row", toExerciseId: "one-arm-db-row" }]) }];
    const { items } = planFor("pull", adv);
    expect(items[0].sets).toBe(4);
    expect(items.some((i) => i.exerciseId === "one-arm-db-row")).toBe(true);
  });
  it("context bouwen met lege data werkt", () => {
    const ctx = buildCoachContext({ profile: { id: "u", display_name: "Sam", level: "beginner", bodyweight_kg: 70, water_goal_ml: 3000, glass_ml: 250, creatine_g: 5, created_at: "2026-10-01T00:00:00Z" }, workouts: [], sets: [], habits: [], today: "2026-10-09" });
    expect(ctx.volgende_training).toBe("push");
    expect(ctx.oefeningen).toEqual([]);
  });
});
