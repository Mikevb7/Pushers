import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ChevronRight, LineChart, Trophy } from "lucide-react";
import { loadProfiles, loadSets, loadSocial, loadWorkouts, requireUser } from "@/lib/data";
import { addDays, dayKey, formatDay } from "@/lib/dates";
import { EXERCISE_MAP, formatLoad } from "@/lib/exercises";
import { bestSet, compareBest, summarize, volumeOf, type CompareRow } from "@/lib/history";
import { GYM_SESSIONS_PER_WEEK } from "@/lib/schedule";
import { weekStatus, weekStreak } from "@/lib/rotation";
import { findPRs } from "@/lib/stats";
import { reactionState } from "@/lib/social";
import { themeFor } from "@/lib/themes";
import { CrewName } from "@/components/CrewName";
import { MonthCalendar } from "@/components/MonthCalendar";
import { WorkoutCard, fmtKg } from "@/components/WorkoutCard";

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, user } = await requireUser();
  const profiles = await loadProfiles(supabase);
  const who = profiles.find((p) => p.id === id);
  if (!who) notFound();
  const me = profiles.find((p) => p.id === user.id);
  const isMe = id === user.id;

  const [workouts, sets, mySets, myWorkouts] = await Promise.all([
    loadWorkouts(supabase, id),
    loadSets(supabase, id),
    isMe ? Promise.resolve([]) : loadSets(supabase, user.id),
    isMe ? Promise.resolve([]) : loadWorkouts(supabase, user.id, 30),
  ]);
  const today = dayKey();
  const done = workouts.filter((w) => w.completed_at);
  const gym = done.filter((w) => w.day_type !== "cardio");
  const prs = findPRs(sets, { [id]: who.bodyweight_kg });
  const recent = done.slice(0, 8);
  const social = await loadSocial(supabase, recent.map((w) => w.id));
  const month = /^\d{4}-\d{2}$/.test(sp.maand ?? "") ? sp.maand! : today.slice(0, 7);
  const theme = themeFor(id);
  const first = name(who.display_name);

  // Beste sets: oefeningen die het vaakst gedaan zijn bovenaan.
  const freq = new Map<string, number>();
  for (const s of sets) freq.set(s.exercise_id, (freq.get(s.exercise_id) ?? 0) + 1);
  const bests = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([exId]) => ({ exId, best: bestSet(sets.filter((s) => s.exercise_id === exId), who.bodyweight_kg)! }));

  // Vergelijken (laatste 30 dagen + beste sets op gedeelde oefeningen).
  const since = addDays(today, -30);
  const last30 = (ws: typeof workouts) => ws.filter((w) => w.completed_at && w.day_type !== "cardio" && dayKey(w.started_at) >= since).length;
  const vol30 = (ss: typeof sets) => volumeOf(ss.filter((s) => dayKey(s.date) >= since));
  const both = new Map<string, number>();
  for (const x of [...mySets, ...sets]) both.set(x.exercise_id, (both.get(x.exercise_id) ?? 0) + 1);
  const compare = isMe
    ? []
    : compareBest(mySets, sets, me?.bodyweight_kg ?? 75, who.bodyweight_kg).sort((a, b) => (both.get(b.exerciseId) ?? 0) - (both.get(a.exerciseId) ?? 0));
  const myWins = compare.filter((c) => c.winner === "ik").length;
  const theirWins = compare.filter((c) => c.winner === "zij").length;

  const stats: [string, string][] = [
    ["Trainingen", String(gym.length)],
    ["Deze week", `${weekStatus(workouts, today).gymDone}/${GYM_SESSIONS_PER_WEEK}`],
    ["Weken vol", String(weekStreak(workouts, today))],
    ["Records", String(prs.length)],
  ];

  return (
    <div data-theme={theme ?? undefined} className={`space-y-6 pt-2 ${theme && !isMe ? "-mx-4 rounded-3xl px-4 pb-4" : ""}`}>
      <Link href="/crew" className="inline-flex items-center gap-1.5 text-sm text-mute">
        <ArrowLeft size={16} /> Crew
      </Link>

      <header className="flex items-center gap-4">
        <span className="display grid size-16 shrink-0 place-items-center rounded-full bg-pin text-3xl font-bold text-chalk">
          {who.display_name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="display truncate text-5xl font-bold uppercase leading-none">
            <CrewName userId={id} name={who.display_name} />
          </h1>
          <p className="mt-1 text-sm text-mute">
            {isMe ? "Jouw profiel" : "Crewlid"} · bezig sinds {formatDay(dayKey(gym.at(-1)?.started_at ?? who.created_at))}
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-4 gap-2">
        {stats.map(([k, v]) => (
          <div key={k} className="card px-2 py-3 text-center">
            <dd className="display text-3xl font-bold">{v}</dd>
            <dt className="text-[11px] text-mute">{k}</dt>
          </div>
        ))}
      </dl>

      <Link href={isMe ? "/progressie" : `/progressie?user=${id}`} className="card flex items-center gap-3 px-4 py-3">
        <LineChart size={18} className="text-pin-deep" aria-hidden />
        <span className="flex-1 font-semibold">Progressie van {isMe ? "jou" : first}</span>
        <ChevronRight size={16} className="text-mute" />
      </Link>

      {!isMe && (
        <section className="card p-4">
          <h2 className="font-semibold">Jij vs {first}</h2>
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-x-3 gap-y-2 text-center">
            <span className="text-xs font-semibold text-mute">Jij</span>
            <span />
            <span className="text-xs font-semibold text-mute">{first}</span>
            {[
              ["Trainingen 30 dagen", last30(myWorkouts), last30(workouts), String],
              ["Volume 30 dagen", vol30(mySets), vol30(sets), fmtKg],
              ["Sterker op", myWins, theirWins, String],
            ].map(([label, a, b, f]) => {
              const fa = (f as (n: number) => string)(a as number);
              const fb = (f as (n: number) => string)(b as number);
              return (
                <Row key={label as string} label={label as string} a={fa} b={fb} winA={(a as number) > (b as number)} winB={(b as number) > (a as number)} />
              );
            })}
          </div>

          {compare.length > 0 ? (
            <>
              <h3 className="mb-2 mt-5 text-sm font-semibold">Beste set per oefening</h3>
              <ul className="space-y-1.5">
                {compare.slice(0, 8).map((c) => <CompareItem key={c.exerciseId} c={c} />)}
              </ul>
              {compare.length > 8 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer py-2 text-center text-sm font-medium text-pin-deep">Alle {compare.length} oefeningen</summary>
                  <ul className="space-y-1.5">
                    {compare.slice(8).map((c) => <CompareItem key={c.exerciseId} c={c} />)}
                  </ul>
                </details>
              )}
              <p className="mt-2 text-xs text-mute">Vergeleken op geschatte max (gewicht én reps). Bij oefeningen met je lichaamsgewicht telt dat mee.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-mute">Nog geen oefeningen die jullie allebei gedaan hebben.</p>
          )}
        </section>
      )}

      <MonthCalendar workouts={done} month={month} hrefForMonth={(m) => `/crew/${id}${m === today.slice(0, 7) ? "" : `?maand=${m}`}`} />

      {bests.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Trophy size={16} className="text-pin-deep" /> Beste sets
          </h2>
          <ul className="grid grid-cols-2 gap-2">
            {bests.map(({ exId, best }) => (
              <li key={exId} className="card p-3">
                <p className="truncate text-xs text-mute">{EXERCISE_MAP[exId]?.name ?? exId}</p>
                <p className="display text-2xl font-bold">
                  {formatLoad(exId, Number(best.weight_kg))} × {best.reps}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Recente trainingen</h2>
        {recent.length === 0 ? (
          <p className="card p-4 text-sm text-mute">Nog geen trainingen.</p>
        ) : (
          <ul className="space-y-2.5">
            {recent.map((w) => (
              <li key={w.id}>
                <WorkoutCard
                  w={w}
                  summary={w.day_type === "cardio" ? null : summarize(w, sets, who.bodyweight_kg)}
                  prs={prs.filter((p) => p.workoutId === w.id)}
                  reactions={reactionState(social.reactions, w.id, user.id)}
                  comments={social.comments.filter((c) => c.workout_id === w.id).length}
                  dateStyle="day"
                />
              </li>
            ))}
          </ul>
        )}
        {isMe && (
          <Link href="/logboek" className="mt-2 block text-center text-sm font-medium text-pin-deep">
            Alles in je logboek
          </Link>
        )}
      </section>
    </div>
  );
}

function name(full: string) {
  return full.split(" ")[0];
}

function Row({ label, a, b, winA, winB }: { label: string; a: string; b: string; winA: boolean; winB: boolean }) {
  return (
    <>
      <span className={`display text-2xl font-bold ${winA ? "text-go" : ""}`}>{a}</span>
      <span className="text-xs text-mute">{label}</span>
      <span className={`display text-2xl font-bold ${winB ? "text-go" : ""}`}>{b}</span>
    </>
  );
}

function CompareItem({ c }: { c: CompareRow }) {
  return (
                  <li className="rounded-lg bg-floor px-3 py-2">
                    <p className="text-sm">{EXERCISE_MAP[c.exerciseId]?.name ?? c.exerciseId}</p>
                    <div className="mt-0.5 grid grid-cols-2 gap-2">
                      <span className={`display text-lg font-semibold ${c.winner === "ik" ? "text-go" : c.winner === "gelijk" ? "" : "text-mute"}`}>
                        {c.winner === "ik" && "👑 "}
                        {formatLoad(c.exerciseId, Number(c.mine.weight_kg))} × {c.mine.reps}
                      </span>
                      <span className={`display text-right text-lg font-semibold ${c.winner === "zij" ? "text-go" : c.winner === "gelijk" ? "" : "text-mute"}`}>
                        {formatLoad(c.exerciseId, Number(c.theirs.weight_kg))} × {c.theirs.reps}
                        {c.winner === "zij" && " 👑"}
                      </span>
                    </div>
                  </li>
  );
}
