import Link from "next/link";
import { HeartPulse, X } from "lucide-react";
import { loadSets, loadSocial, loadWorkouts, requireMe } from "@/lib/data";
import { dayKey, formatDay, weekStart } from "@/lib/dates";
import { DAY_COLOR, summarize } from "@/lib/history";
import { DAY_LABEL, GYM_SESSIONS_PER_WEEK, type DayType } from "@/lib/schedule";
import { nextGymDay, trainingAdvice, weekStatus, weekStreak } from "@/lib/rotation";
import { findPRs } from "@/lib/stats";
import { reactionState } from "@/lib/social";
import { addCardio, quickCheck, removeWorkout } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { MonthCalendar } from "@/components/MonthCalendar";
import { WorkoutCard } from "@/components/WorkoutCard";

const FILTERS: { id: DayType | "alles"; label: string }[] = [
  { id: "alles", label: "Alles" },
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "legs", label: "Legs" },
  { id: "upper", label: "Upper" },
  { id: "cardio", label: "Cardio" },
];
const PAGE = 20;

export default async function LogbookPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireMe();
  const [workouts, sets] = await Promise.all([loadWorkouts(supabase, user.id), loadSets(supabase, user.id)]);
  const today = dayKey();
  const week = weekStatus(workouts, today);
  const next = nextGymDay(workouts);
  const warn = trainingAdvice(workouts, today);
  const streak = weekStreak(workouts, today);

  const month = /^\d{4}-\d{2}$/.test(sp.maand ?? "") ? sp.maand! : today.slice(0, 7);
  const filter = (FILTERS.find((f) => f.id === sp.type)?.id ?? "alles") as DayType | "alles";
  const limit = Math.min(500, Math.max(PAGE, Number(sp.n) || PAGE));
  const href = (o: { maand?: string; type?: string; n?: number }) => {
    const q = new URLSearchParams();
    const m = o.maand ?? month;
    const t = o.type ?? filter;
    if (m !== today.slice(0, 7)) q.set("maand", m);
    if (t !== "alles") q.set("type", t);
    if (o.n && o.n > PAGE) q.set("n", String(o.n));
    const s = q.toString();
    return `/logboek${s ? `?${s}` : ""}`;
  };

  const done = workouts.filter((w) => w.completed_at);
  const filtered = done.filter((w) => filter === "alles" || w.day_type === filter);
  const shown = filtered.slice(0, limit);
  const social = await loadSocial(supabase, shown.map((w) => w.id));
  const prs = findPRs(sets, { [user.id]: profile.bodyweight_kg });

  // Groeperen per week (maandag).
  const groups: { start: string; items: typeof shown }[] = [];
  for (const w of shown) {
    const start = weekStart(dayKey(w.started_at));
    const g = groups.at(-1);
    if (g?.start === start) g.items.push(w);
    else groups.push({ start, items: [w] });
  }
  const totals = { all: done.filter((w) => w.day_type !== "cardio").length };

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold uppercase">Logboek</h1>
        <p className="mt-2 text-mute">
          {totals.all} gymtrainingen in totaal
          {streak > 0 ? `, ${streak} ${streak === 1 ? "volle week" : "volle weken"} op rij` : ""}.
        </p>
      </header>

      <section className="card p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Deze week</h2>
          <p className="text-sm text-mute">
            {week.gymDone} van {GYM_SESSIONS_PER_WEEK} gym, cardio {week.cardioDone ? "gedaan" : "nog niet"}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-1.5" aria-label="Weekdoel">
          {Array.from({ length: GYM_SESSIONS_PER_WEEK }, (_, i) => (
            <div key={i} className={`stack h-10 rounded-md ${i < week.gymDone ? "bg-pin" : "bg-floor"}`} />
          ))}
          <div className={`grid h-10 place-items-center rounded-md ${week.cardioDone ? "bg-go text-floor" : "bg-floor text-mute"}`}>
            <HeartPulse size={18} />
          </div>
        </div>
        <ol className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px]">
          {week.days.map((d) => (
            <li key={d.key} className={d.key === today ? "font-semibold text-chalk" : "text-mute"}>
              {formatDay(d.key).slice(0, 2)}
              <div className="mt-1 flex h-6 flex-col items-center justify-center gap-0.5">
                {d.workouts.map((w) => (
                  <span key={w.id} className="h-1.5 w-5 rounded-full" style={{ background: DAY_COLOR[w.day_type] }} />
                ))}
              </div>
            </li>
          ))}
        </ol>
        {warn && <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">{warn}</p>}
      </section>

      <MonthCalendar workouts={done} month={month} hrefForMonth={(m) => href({ maand: m })} />

      <section>
        <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={href({ type: f.id })}
              scroll={false}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                f.id === filter ? "bg-chalk text-floor" : "bg-steel"
              }`}
            >
              {f.id !== "alles" && <span className="size-2 rounded-full" style={{ background: DAY_COLOR[f.id] }} />}
              {f.label}
            </Link>
          ))}
        </div>

        {groups.length === 0 ? (
          <p className="card p-4 text-sm text-mute">Nog geen trainingen{filter !== "alles" ? ` van ${DAY_LABEL[filter]}` : ""}.</p>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.start}>
                <h3 className="mb-2 text-sm font-semibold text-mute">
                  {g.start === weekStart(today) ? "Deze week" : `Week van ${formatDay(g.start).replace(/^\w+\.? /, "")}`}
                </h3>
                <ul className="space-y-2">
                  {g.items.map((w) => (
                    <li key={w.id} className="relative">
                      <WorkoutCard
                        w={w}
                        summary={w.day_type === "cardio" ? null : summarize(w, sets, profile.bodyweight_kg)}
                        prs={prs.filter((p) => p.workoutId === w.id)}
                        reactions={reactionState(social.reactions, w.id, user.id)}
                        comments={social.comments.filter((c) => c.workout_id === w.id).length}
                        dateStyle="day"
                      />
                      {(w.day_type === "cardio" || w.quick_check) && (
                        <form action={removeWorkout.bind(null, w.id)} className="absolute right-2 top-2">
                          <button aria-label="Verwijderen" className="p-1 text-mute">
                            <X size={15} />
                          </button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {filtered.length > shown.length && (
              <Link href={href({ n: limit + PAGE })} scroll={false} className="block rounded-full bg-steel py-3 text-center font-semibold">
                Meer laden ({filtered.length - shown.length})
              </Link>
            )}
          </div>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Training afvinken</h2>
        <p className="mt-1 text-sm text-mute">
          {DAY_LABEL[next]} gedaan zonder de app? Vink hem af, dan schuift de rotatie door. Er wordt dan geen progressie bijgehouden.
        </p>
        <form action={quickCheck.bind(null, next)} className="mt-3">
          <SubmitButton pendingText="Afvinken…" className="w-full rounded-lg bg-steel-2 py-3 font-semibold">
            {DAY_LABEL[next]} afvinken
          </SubmitButton>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Cardio toevoegen</h2>
        <form action={addCardio} className="mt-3 space-y-2">
          <input name="description" required placeholder="Wat heb je gedaan? Bijv. hardlopen, fietsen" className="w-full rounded-lg border border-line bg-floor px-3 py-2.5" />
          <div className="flex gap-2">
            <input name="minutes" inputMode="numeric" placeholder="Minuten" className="w-28 rounded-lg border border-line bg-floor px-3 py-2.5" />
            <SubmitButton pendingText="Opslaan…" className="flex-1 rounded-lg bg-steel-2 py-2.5 font-semibold">
              Cardio opslaan
            </SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
