import Link from "next/link";
import { ChevronRight, Droplet, Flame, Pill } from "lucide-react";
import { loadHabits, loadProfiles, loadSets, loadSocial, loadWorkouts, requireMe } from "@/lib/data";
import { summarize } from "@/lib/history";
import { reactionState } from "@/lib/social";
import { WorkoutCard } from "@/components/WorkoutCard";
import { addDays, dayKey, daysBetween } from "@/lib/dates";
import { habitStreak, weekStatus, weekStreak } from "@/lib/rotation";
import { CrewName } from "@/components/CrewName";
import { themeFor } from "@/lib/themes";
import { findPRs, formatPct, overallProgress, type Period } from "@/lib/stats";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "maand", label: "Maand" },
  { id: "start", label: "Sinds start" },
];

/** "vandaag", "gisteren", "3 dagen geleden"; vanaf 4 dagen zonder training opvallend. */
function lastAgo(day: string | null, today: string) {
  if (!day) return { text: "nog niet getraind", late: true };
  const d = daysBetween(day, today);
  return { text: d <= 0 ? "vandaag getraind" : d === 1 ? "gisteren getraind" : `${d} dagen geleden`, late: d >= 4 };
}

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
        lastGym: myWorkouts
          .filter((w) => w.completed_at && w.day_type !== "cardio")
          .map((w) => dayKey(w.started_at))
          .sort()
          .at(-1) ?? null,
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
      sets: sets.filter((s) => s.workout_id === w.id).length,
    }))
    .sort((a, b) => b.w.completed_at!.localeCompare(a.w.completed_at!))
    .slice(0, 30);
  const social = await loadSocial(supabase, feed.map((f) => f.w.id));
  const setsBy = new Map<string, typeof sets>();
  for (const s of sets) setsBy.set(s.user_id, [...(setsBy.get(s.user_id) ?? []), s]);

  return (
    <div className="space-y-7">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold uppercase">Crew</h1>
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
                href={`/crew/${b.p.id}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 ${themeFor(b.p.id) === "pride" ? "pride-row" : b.p.id === user.id ? "bg-steel-2" : "bg-steel"}`}
              >
                <span className={`display w-6 text-2xl font-bold ${i === 0 && b.pct !== null ? "text-pin-deep" : "text-mute"}`}>{i + 1}</span>
                <span className="flex-1">
                  <span className="block font-semibold">
                    <CrewName userId={b.p.id} name={b.p.display_name} />
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-mute">
                    <span className={lastAgo(b.lastGym, today).late ? "font-semibold text-warn" : ""}>{lastAgo(b.lastGym, today).text}</span>
                    <span>{b.week}/4 deze week</span>
                    {b.weeks > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Flame size={12} /> {b.weeks} {b.weeks === 1 ? "week" : "weken"} vol
                      </span>
                    )}
                    {b.water > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Droplet size={12} /> water {b.water}d
                      </span>
                    )}
                    {b.creatine > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Pill size={12} /> creatine {b.creatine}d
                      </span>
                    )}
                  </span>
                </span>
                <span className={`display text-3xl font-bold ${b.pct !== null && b.pct > 0 ? "text-go" : "text-mute"}`}>{formatPct(b.pct)}</span>
                <ChevronRight size={16} className="text-mute" aria-hidden />
              </Link>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-mute">
          Gemeten in % sterker op je eigen oefeningen, niet in kilo&apos;s. Zo kan iedereen winnen.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">Feed</h2>
        {feed.length === 0 ? (
          <p className="card p-4 text-sm text-mute">Nog niks gebeurd. Wie gaat er als eerste?</p>
        ) : (
          <ul className="space-y-2.5">
            {feed.map(({ w, prs }) => (
              <li key={w.id}>
                <WorkoutCard
                  w={w}
                  summary={w.day_type === "cardio" ? null : summarize(w, setsBy.get(w.user_id) ?? [], bw[w.user_id] ?? 75)}
                  who={{ id: w.user_id, name: name(w.user_id), isMe: w.user_id === user.id }}
                  prs={prs}
                  reactions={reactionState(social.reactions, w.id, user.id)}
                  comments={social.comments.filter((c) => c.workout_id === w.id).length}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
