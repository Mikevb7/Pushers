import Link from "next/link";
import { Check, HeartPulse, X } from "lucide-react";
import { loadWorkouts, requireMe } from "@/lib/data";
import { addDays, dayKey, formatDay, weekStart } from "@/lib/dates";
import { DAY_LABEL, GYM_SESSIONS_PER_WEEK } from "@/lib/schedule";
import { nextGymDay, trainingAdvice, weekStatus, weekStreak } from "@/lib/rotation";
import { addCardio, quickCheck, removeWorkout } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export default async function WeekPage() {
  const { supabase, user } = await requireMe();
  const workouts = await loadWorkouts(supabase, user.id, 70);
  const today = dayKey();
  const week = weekStatus(workouts, today);
  const next = nextGymDay(workouts);
  const warn = trainingAdvice(workouts, today);
  const streak = weekStreak(workouts, today);

  const pastWeeks = [1, 2, 3, 4].map((i) => {
    const start = addDays(weekStart(today), -7 * i);
    const st = weekStatus(workouts, start);
    return { start, gym: st.gymDone, cardio: st.cardioDone };
  });

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold">Week</h1>
        <p className="mt-2 text-mute">
          {week.gymDone} van {GYM_SESSIONS_PER_WEEK} gymtrainingen, cardio {week.cardioDone ? "gedaan" : "nog niet"}.
          {streak > 0 ? ` ${streak} ${streak === 1 ? "volle week" : "volle weken"} op rij.` : ""}
        </p>
      </header>

      <div className="grid grid-cols-5 gap-1.5" aria-label="Weekdoel">
        {Array.from({ length: GYM_SESSIONS_PER_WEEK }, (_, i) => (
          <div key={i} className={`stack h-14 rounded-md ${i < week.gymDone ? "bg-pin" : "bg-steel"}`} />
        ))}
        <div className={`grid h-14 place-items-center rounded-md ${week.cardioDone ? "bg-go text-floor" : "bg-steel text-mute"}`}>
          <HeartPulse size={20} />
        </div>
      </div>

      {warn && <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">{warn}</p>}

      <ol className="space-y-1.5">
        {week.days.map((d) => (
          <li key={d.key} className={`rounded-lg px-3 py-2.5 ${d.key === today ? "bg-steel-2" : "bg-steel"}`}>
            <div className="flex items-center gap-3">
              <span className={`w-24 text-sm ${d.key === today ? "text-chalk" : "text-mute"}`}>{formatDay(d.key)}</span>
              <div className="flex flex-1 flex-col gap-1">
                {d.workouts.length === 0 && <span className="text-sm text-mute/60">{d.key > today ? "" : "Rust"}</span>}
                {d.workouts.map((w) => (
                  <div key={w.id} className="flex items-center gap-2">
                    {w.day_type === "cardio" ? <HeartPulse size={16} className="text-go" /> : <Check size={16} className="text-pin" />}
                    {w.day_type === "cardio" ? (
                      <span className="flex-1">
                        {w.cardio_description}
                        {w.cardio_minutes ? <span className="text-mute">, {w.cardio_minutes} min</span> : null}
                      </span>
                    ) : (
                      <Link href={`/training/${w.id}/klaar`} className="flex-1 font-semibold">
                        {DAY_LABEL[w.day_type]}
                        {w.quick_check && <span className="font-normal text-mute"> (afgevinkt)</span>}
                      </Link>
                    )}
                    {(w.day_type === "cardio" || w.quick_check) && (
                      <form action={removeWorkout.bind(null, w.id)}>
                        <button aria-label="Verwijderen" className="p-1 text-mute">
                          <X size={15} />
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>

      <section className="rounded-xl bg-steel p-4">
        <h2 className="font-semibold">Training afvinken</h2>
        <p className="mt-1 text-sm text-mute">
          {DAY_LABEL[next]} gedaan zonder de app? Vink hem af, dan schuift de rotatie door. Er wordt dan geen progressie bijgehouden.
        </p>
        <form action={quickCheck.bind(null, next)} className="mt-3">
          <SubmitButton pendingText="Afvinken…" className="w-full rounded-lg bg-steel-2 py-3 font-semibold">{DAY_LABEL[next]} afvinken</SubmitButton>
        </form>
      </section>

      <section className="rounded-xl bg-steel p-4">
        <h2 className="font-semibold">Cardio toevoegen</h2>
        <form action={addCardio} className="mt-3 space-y-2">
          <input name="description" required placeholder="Wat heb je gedaan? Bijv. hardlopen, fietsen" className="w-full rounded-lg border border-line bg-floor px-3 py-2.5" />
          <div className="flex gap-2">
            <input name="minutes" inputMode="numeric" placeholder="Minuten" className="w-28 rounded-lg border border-line bg-floor px-3 py-2.5" />
            <SubmitButton pendingText="Opslaan…" className="flex-1 rounded-lg bg-steel-2 py-2.5 font-semibold">Cardio opslaan</SubmitButton>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Vorige weken</h2>
        <ul className="space-y-1.5">
          {pastWeeks.map((w) => (
            <li key={w.start} className="flex items-center gap-3 rounded-lg bg-steel px-3 py-2.5 text-sm">
              <span className="w-28 text-mute">Week van {formatDay(w.start).replace(/^\w+\.? /, "")}</span>
              <span className="flex flex-1 gap-1">
                {Array.from({ length: GYM_SESSIONS_PER_WEEK }, (_, i) => (
                  <span key={i} className={`h-2.5 flex-1 rounded-sm ${i < w.gym ? "bg-pin" : "bg-floor"}`} />
                ))}
              </span>
              <span className={w.cardio ? "text-go" : "text-mute/50"}>
                <HeartPulse size={15} />
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
