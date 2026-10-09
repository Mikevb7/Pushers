import Link from "next/link";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { loadActiveAdvice, loadHabits, loadSets, loadWorkouts, requireMe } from "@/lib/data";
import { dayKey, WEEKDAY_SHORT } from "@/lib/dates";
import { DAY_LABEL, PLAN, GYM_SESSIONS_PER_WEEK } from "@/lib/schedule";
import { habitStreak, nextGymDay, trainingAdvice, weekStatus } from "@/lib/rotation";
import { formatPct, overallProgress } from "@/lib/stats";
import { planFor } from "@/lib/plan";
import { startWorkout } from "@/app/actions";
import { HabitQuick } from "@/components/HabitQuick";

export default async function Home() {
  const { supabase, user, profile } = await requireMe();
  const [workouts, habits, sets, advice] = await Promise.all([
    loadWorkouts(supabase, user.id),
    loadHabits(supabase, user.id, 400),
    loadSets(supabase, user.id),
    loadActiveAdvice(supabase, user.id),
  ]);

  const today = dayKey();
  const next = nextGymDay(workouts);
  const week = weekStatus(workouts, today);
  const warn = trainingAdvice(workouts, today);
  const openToday = workouts.find((w) => !w.completed_at && w.day_type !== "cardio" && dayKey(w.started_at) === today);
  const doneToday = week.days.find((d) => d.key === today)?.workouts.filter((w) => w.day_type !== "cardio") ?? [];
  const todayLog = habits.find((h) => h.day === today);
  const monthPct = overallProgress(sets, "maand", profile.bodyweight_kg, today);
  const { items, notes } = planFor(next, advice);
  const coachTouched = items.filter((i) => i.coach).length + notes.length;
  const startDay = openToday ? (openToday.day_type as typeof next) : next;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <p className="text-mute">Hoi {profile.display_name}</p>
        <Link
          href="/profiel"
          aria-label="Profiel en instellingen"
          className="grid size-9 place-items-center rounded-full bg-steel-2 font-semibold"
        >
          {profile.display_name.slice(0, 1).toUpperCase()}
        </Link>
      </header>

      <section>
        {doneToday.length > 0 && !openToday ? (
          <div className="flex items-center gap-2 text-go">
            <Check size={18} />
            <span>Vandaag {doneToday.map((w) => DAY_LABEL[w.day_type]).join(" + ")} gedaan</span>
          </div>
        ) : null}
        <p className="mt-2 text-mute">{openToday ? "Bezig met" : doneToday.length ? "Volgende keer" : "Vandaag"}</p>
        <h1 className="display text-[7.5rem] font-bold">{DAY_LABEL[startDay]}</h1>
        <p className="mt-2 text-mute">
          {PLAN[startDay].focus}, {items.length} oefeningen
        </p>

        {warn && !openToday && <p className="mt-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">{warn}</p>}

        {coachTouched > 0 && (
          <Link href="/coach" className="mt-4 flex items-center gap-2 rounded-lg bg-steel px-3 py-2.5 text-sm">
            <Sparkles size={16} className="text-pin" />
            <span className="flex-1">De coach heeft deze training aangepast</span>
            <ChevronRight size={16} className="text-mute" />
          </Link>
        )}

        <form action={startWorkout.bind(null, startDay)} className="mt-5">
          <button className="w-full rounded-xl bg-pin py-4 text-xl font-semibold text-floor active:brightness-95">
            {openToday ? `Ga verder met ${DAY_LABEL[startDay]}` : `Start ${DAY_LABEL[startDay]}`}
          </button>
        </form>
      </section>

      <Link href="/week" className="block rounded-xl bg-steel p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Deze week</p>
          <p className="text-sm text-mute">
            {week.gymDone} van {GYM_SESSIONS_PER_WEEK} gym{week.cardioDone ? ", cardio gedaan" : ""}
          </p>
        </div>
        <ol className="mt-3 grid grid-cols-7 gap-1.5">
          {week.days.map((d, i) => {
            const gym = d.workouts.find((w) => w.day_type !== "cardio");
            const cardio = d.workouts.some((w) => w.day_type === "cardio");
            return (
              <li key={d.key} className="text-center">
                <div
                  className={`grid h-11 place-items-center rounded-md text-xs font-semibold ${
                    gym ? "bg-pin text-floor" : cardio ? "bg-steel-2 text-go" : d.key === today ? "border border-line" : "bg-floor"
                  }`}
                >
                  {gym ? DAY_LABEL[gym.day_type].slice(0, 2) : cardio ? "C" : ""}
                </div>
                <span className={`mt-1 block text-[11px] ${d.key === today ? "text-chalk" : "text-mute"}`}>{WEEKDAY_SHORT[i]}</span>
              </li>
            );
          })}
        </ol>
      </Link>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-semibold">Streaks</h2>
          <Link href="/streaks" className="text-sm text-mute">
            Overzicht
          </Link>
        </div>
        <HabitQuick
          water={todayLog?.water_ml ?? 0}
          goal={profile.water_goal_ml}
          glass={profile.glass_ml}
          creatine={todayLog?.creatine ?? false}
          creatineG={profile.creatine_g}
          waterStreak={habitStreak(habits, (h) => h.water_ml >= profile.water_goal_ml, today)}
          creatineStreak={habitStreak(habits, (h) => h.creatine, today)}
        />
      </section>

      <Link href="/progressie" className="flex items-center justify-between rounded-xl bg-steel p-4">
        <div>
          <p className="font-semibold">Afgelopen maand</p>
          <p className="text-sm text-mute">{monthPct === null ? "Na een paar trainingen zie je hier je groei" : "Gemiddeld sterker op je oefeningen"}</p>
        </div>
        <span className={`display text-4xl font-bold ${monthPct !== null && monthPct > 0 ? "text-go" : ""}`}>{formatPct(monthPct)}</span>
      </Link>
    </div>
  );
}
