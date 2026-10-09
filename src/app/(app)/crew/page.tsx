import Link from "next/link";
import { Droplet, Flame, HeartPulse, Pill, Trophy } from "lucide-react";
import { loadHabits, loadProfiles, loadSets, loadWorkouts, requireMe } from "@/lib/data";
import { addDays, dayKey, timeAgo } from "@/lib/dates";
import { EXERCISE_MAP } from "@/lib/exercises";
import { DAY_LABEL } from "@/lib/schedule";
import { habitStreak, weekStatus, weekStreak } from "@/lib/rotation";
import { findPRs, formatPct, overallProgress, type Period } from "@/lib/stats";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "maand", label: "Maand" },
  { id: "start", label: "Sinds start" },
];
const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ periode?: string }> }) {
  const sp = await searchParams;
  const period = (PERIODS.find((p) => p.id === sp.periode)?.id ?? "maand") as Period;
  const { supabase, user } = await requireMe();
  const [profiles, workouts, sets, habits] = await Promise.all([
    loadProfiles(supabase),
    loadWorkouts(supabase, undefined, 400),
    loadSets(supabase),
    loadHabits(supabase, undefined, 400),
  ]);
  const today = dayKey();
  const bw = Object.fromEntries(profiles.map((p) => [p.id, p.bodyweight_kg]));
  const name = (id: string) => (id === user.id ? "Jij" : (profiles.find((p) => p.id === id)?.display_name ?? "Iemand"));

  const board = profiles
    .map((p) => {
      const mySets = sets.filter((s) => s.user_id === p.id);
      const myWorkouts = workouts.filter((w) => w.user_id === p.id);
      const myHabits = habits.filter((h) => h.user_id === p.id);
      return {
        p,
        pct: overallProgress(mySets, period, p.bodyweight_kg, today),
        week: weekStatus(myWorkouts, today).gymDone,
        weeks: weekStreak(myWorkouts, today),
        water: habitStreak(myHabits, (h) => h.water_ml >= p.water_goal_ml, today),
        creatine: habitStreak(myHabits, (h) => h.creatine, today),
      };
    })
    .sort((a, b) => (b.pct ?? -Infinity) - (a.pct ?? -Infinity));

  const since = addDays(today, -14);
  const prs = findPRs(sets, bw).filter((p) => dayKey(p.date) >= since);
  const feed = workouts
    .filter((w) => w.completed_at && dayKey(w.completed_at) >= since)
    .map((w) => ({
      w,
      prs: prs.filter((p) => p.workoutId === w.id),
      sets: sets.filter((s) => s.workout_id === w.id && !s.is_drop).length,
    }))
    .sort((a, b) => b.w.completed_at!.localeCompare(a.w.completed_at!))
    .slice(0, 30);

  return (
    <div className="space-y-7">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold">Crew</h1>
      </header>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Wie wordt het hardst sterker</h2>
        </div>
        <div className="mb-3 grid grid-cols-3 rounded-lg bg-steel p-1">
          {PERIODS.map((p) => (
            <Link key={p.id} href={`/crew?periode=${p.id}`} className={`rounded-md py-2 text-center text-sm font-semibold ${p.id === period ? "bg-steel-2" : "text-mute"}`}>
              {p.label}
            </Link>
          ))}
        </div>
        <ol className="space-y-1.5">
          {board.map((b, i) => (
            <li key={b.p.id}>
              <Link
                href={`/progressie?${b.p.id === user.id ? "" : `user=${b.p.id}&`}periode=${period}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 ${b.p.id === user.id ? "bg-steel-2" : "bg-steel"}`}
              >
                <span className={`display w-6 text-2xl font-bold ${i === 0 && b.pct !== null ? "text-pin" : "text-mute"}`}>{i + 1}</span>
                <span className="flex-1">
                  <span className="block font-semibold">{b.p.display_name}</span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-mute">
                    <span>{b.week}/4 deze week</span>
                    {b.weeks > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Flame size={12} /> {b.weeks} wk
                      </span>
                    )}
                    {b.water > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Droplet size={12} /> {b.water}
                      </span>
                    )}
                    {b.creatine > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Pill size={12} /> {b.creatine}
                      </span>
                    )}
                  </span>
                </span>
                <span className={`display text-3xl font-bold ${b.pct !== null && b.pct > 0 ? "text-go" : "text-mute"}`}>{formatPct(b.pct)}</span>
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-mute">
          Gemeten in % sterker op je eigen oefeningen, niet in kilo&apos;s. Zo kan iedereen winnen.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Afgelopen twee weken</h2>
        {feed.length === 0 ? (
          <p className="rounded-xl bg-steel p-4 text-sm text-mute">Nog niks gebeurd. Wie gaat er als eerste?</p>
        ) : (
          <ul className="space-y-2">
            {feed.map(({ w, prs, sets }) => (
              <li key={w.id} className="rounded-xl bg-steel p-3">
                <div className="flex items-baseline gap-2">
                  {w.day_type === "cardio" && <HeartPulse size={15} className="self-center text-go" />}
                  <p className="flex-1">
                    <span className="font-semibold">{name(w.user_id)}</span>{" "}
                    {w.day_type === "cardio"
                      ? `deed cardio: ${w.cardio_description}${w.cardio_minutes ? `, ${w.cardio_minutes} min` : ""}`
                      : `deed ${DAY_LABEL[w.day_type]}${w.quick_check ? "" : `, ${sets} sets`}`}
                  </p>
                  <span className="shrink-0 text-xs text-mute">{timeAgo(w.completed_at!)}</span>
                </div>
                {prs.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {prs.slice(0, 2).map((p) => (
                      <li key={p.exerciseId} className="flex items-center gap-2 text-sm">
                        <Trophy size={14} className="shrink-0 text-pin" />
                        Record {EXERCISE_MAP[p.exerciseId]?.name}: {fmt(p.weight)} kg × {p.reps}
                      </li>
                    ))}
                    {prs.length > 2 && <li className="pl-[22px] text-sm text-mute">en nog {prs.length - 2} andere records</li>}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
