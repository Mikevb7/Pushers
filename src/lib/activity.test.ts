import { describe, expect, it } from "vitest";
import { activeNow, daypart, doneSentence, noticesFor, recentDone } from "./activity";
import type { Workout } from "./types";

const w = (id: string, user_id: string, day_type: Workout["day_type"], started: string, completed: string | null): Workout => ({
  id,
  user_id,
  day_type,
  started_at: started,
  completed_at: completed,
  quick_check: false,
  cardio_description: null,
  cardio_minutes: null,
  notes: null,
});
const now = new Date("2026-10-13T14:30:00Z"); // 16:30 in Amsterdam

describe("crew-activiteit", () => {
  it("dagdeel", () => {
    expect(daypart("2026-10-13T11:00:00Z", now)).toBe("vanmiddag"); // 13:00 NL
    expect(daypart("2026-10-13T06:00:00Z", now)).toBe("vanochtend");
    expect(daypart("2026-10-12T17:00:00Z", now)).toBe("gisteravond");
    expect(daypart("2026-10-10T17:00:00Z", now)).toBe("");
  });
  it("nu bezig: open en recent, niet jezelf", () => {
    const ws = [
      w("a", "sem", "upper", "2026-10-13T14:00:00Z", null),
      w("b", "me", "upper", "2026-10-13T14:00:00Z", null),
      w("c", "niek", "push", "2026-10-13T08:00:00Z", null), // te oud
    ];
    expect(activeNow(ws, "me", now).map((x) => x.id)).toEqual(["a"]);
  });
  it("samen getraind: Jij en Jair hebben vanmiddag Upper gedaan", () => {
    const ws = [
      w("a", "me", "upper", "2026-10-13T11:13:00Z", "2026-10-13T12:30:00Z"),
      w("b", "jair", "upper", "2026-10-13T11:13:00Z", "2026-10-13T12:35:00Z"),
      w("c", "sem", "legs", "2026-10-12T17:00:00Z", "2026-10-12T18:00:00Z"),
      w("d", "me", "push", "2026-10-12T08:00:00Z", "2026-10-12T09:00:00Z"), // alleen ik: niet tonen
    ];
    const g = recentDone(ws, "me", now);
    const names: Record<string, string> = { jair: "Jair", sem: "Sem" };
    const lines = g.map((x) => doneSentence(x, (id) => names[id], "me"));
    expect(lines).toContain("Jij en Jair hebben vanmiddag Upper gedaan");
    expect(lines).toContain("Sem heeft gisteravond Legs gedaan");
    expect(lines).toHaveLength(2);
  });
  it("meldingen: reacties gebundeld per training, comments los, eigen reacties niet", () => {
    const mine = [w("a", "me", "upper", "2026-10-13T11:00:00Z", "2026-10-13T12:00:00Z")];
    const r = [
      { workout_id: "a", user_id: "sem", emoji: "🔥" as const, created_at: "2026-10-13T13:00:00Z" },
      { workout_id: "a", user_id: "niek", emoji: "💪" as const, created_at: "2026-10-13T13:05:00Z" },
      { workout_id: "a", user_id: "me", emoji: "💪" as const, created_at: "2026-10-13T13:06:00Z" },
    ];
    const c = [{ id: "1", workout_id: "a", user_id: "sem", body: "Beest", created_at: "2026-10-13T13:10:00Z" }];
    const n = noticesFor(mine, r, c, "me", "2026-10-10T00:00:00Z");
    expect(n).toHaveLength(2);
    expect(n[0].kind).toBe("comment");
    expect(n[1].userIds).toEqual(["sem", "niek"]);
  });
});
