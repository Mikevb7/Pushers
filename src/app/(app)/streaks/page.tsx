import { loadHabits, requireMe } from "@/lib/data";
import { addDays, dayKey, weekStart, WEEKDAY_SHORT } from "@/lib/dates";
import { habitStreak } from "@/lib/rotation";
import { HabitQuick } from "@/components/HabitQuick";
import type { HabitLog } from "@/lib/types";

function longest(logs: HabitLog[], ok: (l: HabitLog) => boolean): number {
  const days = logs.filter(ok).map((l) => l.day).sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return best;
}

export default async function StreaksPage() {
  const { supabase, user, profile } = await requireMe();
  const habits = await loadHabits(supabase, user.id, 400);
  const today = dayKey();
  const log = habits.find((h) => h.day === today);
  const waterOk = (h: HabitLog) => h.water_ml >= profile.water_goal_ml;
  const creaOk = (h: HabitLog) => h.creatine;
  const byDay = new Map(habits.map((h) => [h.day, h]));

  // 5 weken, maandag t/m zondag
  const start = addDays(weekStart(today), -28);
  const grid = Array.from({ length: 35 }, (_, i) => addDays(start, i));

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold">Streaks</h1>
      </header>

      <HabitQuick
        big
        water={log?.water_ml ?? 0}
        goal={profile.water_goal_ml}
        glass={profile.glass_ml}
        creatine={log?.creatine ?? false}
        creatineG={profile.creatine_g}
        waterStreak={habitStreak(habits, waterOk, today)}
        creatineStreak={habitStreak(habits, creaOk, today)}
      />

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-steel p-3">
          <dt className="text-sm text-mute">Langste water-streak</dt>
          <dd className="display text-4xl font-bold">{longest(habits, waterOk)}</dd>
        </div>
        <div className="rounded-xl bg-steel p-3">
          <dt className="text-sm text-mute">Langste creatine-streak</dt>
          <dd className="display text-4xl font-bold">{longest(habits, creaOk)}</dd>
        </div>
      </dl>

      <section>
        <h2 className="mb-1 font-semibold">Laatste 5 weken</h2>
        <p className="mb-3 text-sm text-mute">Linkerhelft water gehaald, rechterhelft creatine genomen.</p>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d) => (
            <span key={d} className="text-center text-xs text-mute">
              {d}
            </span>
          ))}
          {grid.map((d) => {
            const h = byDay.get(d);
            const future = d > today;
            return (
              <div
                key={d}
                title={d}
                className={`flex h-9 overflow-hidden rounded-md ${future ? "opacity-20" : ""} ${d === today ? "ring-1 ring-chalk" : ""}`}
              >
                <span className={`flex-1 ${h && waterOk(h) ? "bg-pin" : "bg-steel"}`} />
                <span className={`flex-1 border-l border-floor ${h && creaOk(h) ? "bg-go" : "bg-steel"}`} />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
