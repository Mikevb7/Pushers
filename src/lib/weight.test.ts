import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { weightSummary, weightTrend } from "./weight";

const daily = Array.from({ length: 40 }, (_, i) => ({ day: addDays("2026-09-10", i), kg: 72 - i * 0.05 + (i % 2 ? 0.8 : -0.8) }));

describe("lichaamsgewicht", () => {
  it("elke dag wegen: trendlijn dempt de schommelingen", () => {
    const t = weightTrend(daily)!;
    expect(t).not.toBeNull();
    const swingRaw = Math.max(...daily.slice(-7).map((p) => p.kg)) - Math.min(...daily.slice(-7).map((p) => p.kg));
    const swingTrend = Math.max(...t.slice(-7).map((p) => p.kg)) - Math.min(...t.slice(-7).map((p) => p.kg));
    expect(swingTrend).toBeLessThan(swingRaw / 3);
  });
  it("eens per maand wegen: geen nep-trend, gewoon de metingen", () => {
    const monthly = [
      { day: "2026-06-01", kg: 74 },
      { day: "2026-07-01", kg: 73.2 },
      { day: "2026-08-01", kg: 72.5 },
      { day: "2026-09-01", kg: 72 },
      { day: "2026-10-01", kg: 71.4 },
      { day: "2026-10-19", kg: 71 },
    ];
    expect(weightTrend(monthly)).toBeNull();
    const s = weightSummary(monthly, "2026-10-19")!;
    expect(s.usesTrend).toBe(false);
    expect(s.current).toBe(71);
    expect(s.change).toBe(-0.4); // dichtst bij 30 dagen terug (en minstens 14 dagen oud) is 1 okt: 71,4
  });
  it("één meting: wel huidig gewicht, geen verandering", () => {
    const s = weightSummary([{ day: "2026-10-19", kg: 70 }], "2026-10-19")!;
    expect(s).toMatchObject({ current: 70, change: null });
  });
});
