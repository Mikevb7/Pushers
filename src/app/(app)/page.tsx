import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, ChevronRight, MessageCircle, Repeat, Sparkles } from "lucide-react";
import { closeStaleWorkouts, loadActiveAdvice, loadHabits, loadProfiles, loadSets, loadSocial, loadWorkouts, requireMe } from "@/lib/data";
import { activeNow, daypart, joinNames, noticesFor } from "@/lib/activity";
import { summarize } from "@/lib/history";
import { reactionState } from "@/lib/social";
import { WorkoutCard } from "@/components/WorkoutCard";
import { AutoRefresh } from "@/components/AutoRefresh";
import { dayKey, timeAgo, WEEKDAY_SHORT } from "@/lib/dates";
import { DAY_LABEL, PLAN, GYM_SESSIONS_PER_WEEK, ROTATION } from "@/lib/schedule";
import { habitStreak, nextGymDay, trainingAdvice, weekStatus } from "@/lib/rotation";
import { findPRs, formatPct, overallProgress } from "@/lib/stats";
import { planFor } from "@/lib/plan";
import { startWorkout } from "@/app/actions";
import { HabitQuick } from "@/components/HabitQuick";
import { SubmitButton } from "@/components/SubmitButton";
import { CrewName } from "@/components/CrewName";
import { themeFor } from "@/lib/themes";

const HERO_PHOTO = {
  push: "/equipment/smith-machine.webp",
  pull: "/equipment/evolve-pulldown.webp",
  legs: "/equipment/leg-press-calf.webp",
  upper: "/equipment/bench-press.webp",
} as const;

export default async function Home() {
  const { supabase, user, profile } = await requireMe();
  await closeStaleWorkouts(supabase, user.id);
  const [workouts, habits, sets, advice, crewWorkouts, profiles] = await Promise.all([
    loadWorkouts(supabase, user.id),
    loadHabits(supabase, user.id, 400),
    loadSets(supabase, user.id),
    loadActiveAdvice(supabase, user.id),
    loadWorkouts(supabase, undefined, 7),
    loadProfiles(supabase),
  ]);

  // Crew: wie is nu bezig, wie heeft vandaag/gisteren getraind, reacties op jouw trainingen.
  const nameOf = (id: string) => (id === user.id ? "Jij" : (profiles.find((p) => p.id === id)?.display_name ?? "Iemand"));
  const busy = activeNow(crewWorkouts, user.id);
  const busySets = busy.length
    ? (((await supabase.from("sets").select("workout_id").in("workout_id", busy.map((w) => w.id))).data ?? []) as { workout_id: string }[])
    : [];
  // Crew deze week: afgeronde trainingen van de anderen, nieuwste eerst.
  const crewWeek = crewWorkouts
    .filter((w) => w.completed_at && w.user_id !== user.id && !w.quick_check)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))
    .slice(0, 6);
  const crewIds = [...new Set(crewWeek.map((w) => w.user_id))];
  const crewSets = crewIds.length
    ? (await Promise.all(crewIds.map((id) => loadSets(supabase, id)))).flat()
    : [];
  const crewSocial = await loadSocial(supabase, crewWeek.map((w) => w.id));
  const crewWeekShown = crewWeek.filter((w) => w.day_type === "cardio" || crewSets.some((x) => x.workout_id === w.id));
  const bwOf = (id: string) => profiles.find((p) => p.id === id)?.bodyweight_kg ?? 75;
  const crewPrs = findPRs(crewSets, Object.fromEntries(profiles.map((p) => [p.id, p.bodyweight_kg])));
  const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const myRecent = workouts.filter((w) => w.completed_at && w.completed_at > new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString());
  const social = await loadSocial(supabase, myRecent.map((w) => w.id));
  const notices = noticesFor(myRecent, social.reactions, social.comments, user.id, since).slice(0, 4);

  const today = dayKey();
  const pride = themeFor(user.id) === "pride";
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
        <div>
          <p className="display text-2xl font-semibold uppercase tracking-wide text-pin-deep">Pushers</p>
          <p className="text-sm text-mute">
            Hoi <CrewName userId={user.id} name={profile.display_name} />
          </p>
        </div>
        <Link
          href="/profiel"
          aria-label="Profiel en instellingen"
          className="grid size-10 place-items-center rounded-full bg-steel font-semibold shadow-sm"
        >
          {profile.display_name.slice(0, 1).toUpperCase()}
        </Link>
      </header>

      <section className="relative overflow-hidden rounded-[1.75rem] bg-night text-white">
        <Image src={HERO_PHOTO[startDay]} alt="" fill priority sizes="448px" className="object-cover opacity-55" />
        <div
          className={`absolute inset-0 ${
            pride ? "bg-gradient-to-br from-[#ff5fa8]/55 via-night/55 to-night/90" : "bg-gradient-to-b from-night/30 via-night/50 to-night/90"
          }`}
        />
        {pride && <div className="pride-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden />}
        <div className="relative flex min-h-[22rem] flex-col justify-end p-5">
          {doneToday.length > 0 && !openToday ? (
            <span className="mb-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-pin px-3 py-1 text-sm font-semibold text-chalk">
              <Check size={15} /> Vandaag {doneToday.map((w) => DAY_LABEL[w.day_type]).join(" + ")} gedaan
            </span>
          ) : null}
          <p className="text-sm font-medium text-white/75">{openToday ? "Bezig met" : doneToday.length ? "Volgende training" : "Training van vandaag"}</p>
          <h1 className="display mt-1 text-[6.5rem] font-bold uppercase leading-[0.85]">{DAY_LABEL[startDay]}</h1>
          <p className="mt-3 text-white/80">
            {PLAN[startDay].focus}, {items.length} oefeningen
          </p>
          <form action={startWorkout.bind(null, startDay)} className="mt-5">
            <SubmitButton
              pendingText="Training openen…"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-pin py-4 text-lg font-semibold text-chalk active:brightness-95"
            >
              {openToday ? `Ga verder met ${DAY_LABEL[startDay]}` : `Start ${DAY_LABEL[startDay]}`}
              <ArrowRight size={20} aria-hidden />
            </SubmitButton>
          </form>
        </div>
      </section>

      {(busy.length > 0 || notices.length > 0) && (
        <section className="card divide-y divide-line overflow-hidden">
          {busy.map((w) => {
            const mins = Math.max(1, Math.round((Date.now() - new Date(w.started_at).getTime()) / 60000));
            const n = busySets.filter((x) => x.workout_id === w.id).length;
            return (
              <Link key={w.id} href={`/training/${w.id}/klaar`} className="flex items-center gap-3 px-4 py-3">
                <span className="relative flex size-3 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-pin opacity-60" />
                  <span className="relative inline-flex size-3 rounded-full bg-pin" />
                </span>
                <span className="flex-1 text-sm">
                  <span className="font-semibold">
                    <CrewName userId={w.user_id} name={nameOf(w.user_id)} />
                  </span>{" "}
                  is nu bezig met <span className="font-semibold">{DAY_LABEL[w.day_type]}</span>
                  <span className="block text-xs text-mute">
                    {mins} min{n ? `, ${n} sets` : ""}
                  </span>
                </span>
                <ChevronRight size={16} className="text-mute" aria-hidden />
              </Link>
            );
          })}
          {notices.map((n) => (
            <Link key={n.id} href={`/training/${n.workoutId}/klaar#reacties`} className="flex items-center gap-3 px-4 py-3">
              <span className="w-6 shrink-0 text-center text-lg leading-none" aria-hidden>
                {n.kind === "comment" ? <MessageCircle size={18} className="mx-auto text-pin-deep" /> : n.emojis.slice(0, 2).join("")}
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-semibold">{joinNames(n.userIds.map(nameOf))}</span>{" "}
                {n.kind === "comment" ? (
                  <>
                    op je {DAY_LABEL[myRecent.find((w) => w.id === n.workoutId)?.day_type ?? "push"]}:{" "}
                    <span className="text-mute">&ldquo;{n.body}&rdquo;</span>
                  </>
                ) : (
                  <>reageerde{n.userIds.length > 1 ? "n" : ""} op je {DAY_LABEL[myRecent.find((w) => w.id === n.workoutId)?.day_type ?? "push"]}</>
                )}
                <span className="block text-xs text-mute">{timeAgo(n.at)}</span>
              </span>
              <ChevronRight size={16} className="text-mute" aria-hidden />
            </Link>
          ))}
          {busy.length > 0 && <AutoRefresh seconds={60} />}
        </section>
      )}

      {crewWeekShown.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-semibold">Crew deze week</h2>
            <Link href="/crew" className="text-sm text-mute">
              Alles
            </Link>
          </div>
          <ul className="space-y-2.5">
            {crewWeekShown.map((w) => {
              const cs = crewSocial.comments.filter((c) => c.workout_id === w.id);
              return (
                <li key={w.id}>
                  <WorkoutCard
                    w={w}
                    summary={summarize(w, crewSets.filter((x) => x.user_id === w.user_id), bwOf(w.user_id))}
                    who={{ id: w.user_id, name: nameOf(w.user_id), isMe: false }}
                    prs={crewPrs.filter((p) => p.workoutId === w.id)}
                    reactions={reactionState(crewSocial.reactions, w.id, user.id)}
                    comments={cs.length}
                    latestComments={cs.slice(-2).map((c) => ({ id: c.id, name: nameOf(c.user_id), body: c.body }))}
                    maxExercises={2}
                    whenLabel={daypart(w.started_at) || undefined}
                    reactedBy={joinNames([...new Set(crewSocial.reactions.filter((r) => r.workout_id === w.id).map((r) => nameOf(r.user_id)))]) || undefined}
                  />
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!openToday && (
        <details className="card group px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
            <Repeat size={15} className="text-pin-deep" aria-hidden />
            <span className="flex-1">Samen met iemand trainen? Kies een andere training</span>
            <ChevronDown size={16} className="text-mute transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="mt-2 text-sm text-mute">
            Alleen doen als het echt moet, bijvoorbeeld om met een maat mee te trainen. Je schema gaat daarna verder vanaf de training die je kiest.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {ROTATION.filter((d) => d !== startDay).map((d) => (
              <form key={d} action={startWorkout.bind(null, d)}>
                <SubmitButton pendingText="…" className="w-full rounded-xl bg-steel-2 py-3 font-semibold active:brightness-95">
                  {DAY_LABEL[d]}
                </SubmitButton>
              </form>
            ))}
          </div>
        </details>
      )}

      {warn && !openToday && <p className="rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm">{warn}</p>}

      {coachTouched > 0 && (
        <Link href="/coach" className="card flex items-center gap-2 px-4 py-3 text-sm">
          <Sparkles size={16} className="text-pin-deep" />
          <span className="flex-1">De coach heeft deze training aangepast</span>
          <ChevronRight size={16} className="text-mute" />
        </Link>
      )}

      <Link href="/logboek" className="block card p-4">
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
                    gym ? "bg-pin text-chalk" : cardio ? "bg-steel-2 text-go" : d.key === today ? "border border-line" : "bg-floor"
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

      <Link href="/progressie" className="flex items-center justify-between card p-4">
        <div>
          <p className="font-semibold">Afgelopen maand</p>
          <p className="text-sm text-mute">{monthPct === null ? "Na een paar trainingen zie je hier je groei" : "Gemiddeld sterker op je oefeningen"}</p>
        </div>
        <span className={`display text-4xl font-bold ${monthPct !== null && monthPct > 0 ? "text-go" : ""}`}>{formatPct(monthPct)}</span>
      </Link>
    </div>
  );
}
