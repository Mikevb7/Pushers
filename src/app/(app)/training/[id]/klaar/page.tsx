import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Trash2, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { loadProfiles, loadSets, loadSocial, requireUser } from "@/lib/data";
import { dayKey, formatDay, timeAgo } from "@/lib/dates";
import { EXERCISE_MAP, formatLoad } from "@/lib/exercises";
import { DAY_COLOR, summarize } from "@/lib/history";
import { DAY_LABEL } from "@/lib/schedule";
import { findPRs } from "@/lib/stats";
import { reactionState } from "@/lib/social";
import { themeFor } from "@/lib/themes";
import type { Workout } from "@/lib/types";
import { addComment, deleteComment } from "@/app/actions";
import { CompletionRing } from "@/components/CompletionRing";
import { CrewName } from "@/components/CrewName";
import { Reactions } from "@/components/Reactions";
import { SubmitButton } from "@/components/SubmitButton";
import { DeltaBadge, fmtKg } from "@/components/WorkoutCard";

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const pctDiff = (a: number, b: number) => Math.round((a / b - 1) * 100);

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>();
  if (!workout) notFound();

  const mine = workout.user_id === user.id;
  const [profiles, sets, social] = await Promise.all([loadProfiles(supabase), loadSets(supabase, workout.user_id), loadSocial(supabase, [id])]);
  const owner = profiles.find((p) => p.id === workout.user_id);
  const bw = owner?.bodyweight_kg ?? 75;
  const summary = summarize(workout, sets, bw);
  const prs = findPRs(sets, { [workout.user_id]: bw }).filter((p) => p.workoutId === id);
  const justDone = mine && workout.completed_at && Date.now() - new Date(workout.completed_at).getTime() < 3 * 3600 * 1000;
  const nameOf = (uid: string) => profiles.find((p) => p.id === uid)?.display_name ?? "Iemand";
  const theme = themeFor(workout.user_id);

  // Vorige training van hetzelfde type, om mee te vergelijken.
  const { data: prevRows } = await supabase
    .from("workouts")
    .select("*")
    .eq("user_id", workout.user_id)
    .eq("day_type", workout.day_type)
    .eq("quick_check", false)
    .not("completed_at", "is", null)
    .lt("started_at", workout.started_at)
    .order("started_at", { ascending: false })
    .limit(1);
  const prev = (prevRows?.[0] as Workout | undefined) ?? null;
  const prevSummary = prev ? summarize(prev, sets, bw) : null;
  const ups = summary.exercises.filter((e) => (e.deltaPct ?? 0) >= 0.5).sort((a, b) => b.deltaPct! - a.deltaPct!);
  const downs = summary.exercises.filter((e) => (e.deltaPct ?? 0) <= -0.5).sort((a, b) => a.deltaPct! - b.deltaPct!);

  return (
    <div data-theme={theme ?? undefined} className={`space-y-5 pt-2 ${theme && !mine ? "-mx-4 rounded-3xl px-4 pb-4" : ""}`}>
      <Link href={mine ? "/logboek" : `/crew/${workout.user_id}`} className="inline-flex items-center gap-1.5 text-sm text-mute">
        <ArrowLeft size={16} /> {mine ? "Logboek" : nameOf(workout.user_id)}
      </Link>

      <header className="relative overflow-hidden rounded-[1.75rem] bg-night p-5 text-white">
        <div className="absolute inset-0 opacity-90" style={{ background: `radial-gradient(circle at 85% 15%, ${DAY_COLOR[workout.day_type]}66, transparent 55%)` }} aria-hidden />
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: DAY_COLOR[workout.day_type] }} aria-hidden />
        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/70">
              {justDone ? (
                "Training afgerond 💪"
              ) : (
                <>
                  {mine ? "Jouw training" : <CrewName userId={workout.user_id} name={nameOf(workout.user_id)} />} · {formatDay(dayKey(workout.started_at))}
                </>
              )}
            </p>
            <h1 className="display mt-1 text-[4.75rem] font-bold uppercase leading-[0.85]">{DAY_LABEL[workout.day_type]}</h1>
            <p className="mt-2 text-sm text-white/75">
              {summary.minutes !== null ? `${summary.minutes} min` : ""}
              {workout.completed_at ? ` · afgerond ${timeAgo(workout.completed_at)}` : " · nog bezig"}
            </p>
          </div>
          {summary.completion && (
            <div className="text-center">
              <span className="rounded-full bg-white/95 p-1.5 inline-grid text-chalk">
                <CompletionRing pct={summary.completion.pct} size={76} stroke={7} />
              </span>
              <p className="mt-1 text-xs text-white/75">
                {summary.completion.done} van {summary.completion.planned} sets
              </p>
            </div>
          )}
        </div>
      </header>

      <dl className="grid grid-cols-3 gap-2">
        {[
          { k: "Volume", v: summary.volume ? fmtKg(summary.volume) : "–", d: prevSummary?.volume && summary.volume ? pctDiff(summary.volume, prevSummary.volume) : null },
          { k: "Sets", v: String(summary.setCount), d: prevSummary ? summary.setCount - prevSummary.setCount : null, abs: true },
          { k: "Records", v: String(prs.length), d: null },
        ].map(({ k, v, d, abs }) => (
          <div key={k} className="card p-3">
            <dt className="text-sm text-mute">{k}</dt>
            <dd className="display text-3xl font-bold">{v}</dd>
            {d !== null && d !== undefined && Math.abs(d) > 0 && (
              <dd className={`text-xs font-semibold ${d > 0 ? "text-go" : "text-warn"}`}>
                {d > 0 ? "+" : ""}
                {abs ? d : `${d}%`} vs vorige
              </dd>
            )}
          </div>
        ))}
      </dl>

      {(ups.length > 0 || downs.length > 0) && (
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">Ten opzichte van je vorige {DAY_LABEL[workout.day_type]}</h2>
          {ups.length > 0 && (
            <ul className="space-y-1 text-sm">
              {ups.map((e) => (
                <li key={e.exerciseId} className="flex items-center gap-2">
                  <TrendingUp size={15} className="shrink-0 text-go" aria-hidden />
                  <span className="flex-1">{EXERCISE_MAP[e.exerciseId]?.name}</span>
                  <span className="text-mute">
                    {formatLoad(e.exerciseId, Number(e.best.weight_kg))} × {e.best.reps}
                  </span>
                  <DeltaBadge pct={e.deltaPct} />
                </li>
              ))}
            </ul>
          )}
          {downs.length > 0 && (
            <ul className="space-y-1 text-sm">
              {downs.map((e) => (
                <li key={e.exerciseId} className="flex items-center gap-2">
                  <TrendingDown size={15} className="shrink-0 text-warn" aria-hidden />
                  <span className="flex-1">{EXERCISE_MAP[e.exerciseId]?.name}</span>
                  <span className="text-mute">
                    {formatLoad(e.exerciseId, Number(e.best.weight_kg))} × {e.best.reps}
                  </span>
                  <DeltaBadge pct={e.deltaPct} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {summary.completion && summary.completion.missing.length > 0 && (
        <section className="rounded-2xl border border-warn/30 bg-warn/5 p-4 text-sm">
          <h2 className="mb-1 font-semibold">Niet (helemaal) gedaan</h2>
          <ul className="space-y-0.5">
            {summary.completion.missing.map((m) => (
              <li key={m.exerciseId} className="flex justify-between gap-2">
                <span>{EXERCISE_MAP[m.exerciseId]?.name}</span>
                <span className="text-mute">
                  {m.done}/{m.planned} sets
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {prs.length > 0 && (
        <section className="rounded-2xl border border-pin/50 bg-pin-dim/40 p-4">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Trophy size={18} className="text-pin-deep" /> {prs.length === 1 ? "Nieuw record" : `${prs.length} nieuwe records`}
          </h2>
          <ul className="space-y-1">
            {prs.map((p) => (
              <li key={p.exerciseId}>
                {EXERCISE_MAP[p.exerciseId]?.name}: {formatLoad(p.exerciseId, p.weight)} × {p.reps}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        {summary.exercises.map((e) => {
          const ex = EXERCISE_MAP[e.exerciseId];
          return (
            <article key={e.exerciseId} className="card p-3">
              <div className="flex items-start gap-2">
                <h3 className="flex-1 font-semibold leading-tight">{ex?.name ?? e.exerciseId}</h3>
                <DeltaBadge pct={e.deltaPct} />
              </div>
              {e.prevBest && (
                <p className="mt-0.5 text-xs text-mute">
                  Vorige keer beste set {formatLoad(e.exerciseId, Number(e.prevBest.weight_kg))} × {e.prevBest.reps}
                </p>
              )}
              <ol className="mt-2 space-y-1">
                {e.sets.map((s) => {
                  const best = s.id === e.best.id;
                  return (
                    <li key={s.id} className={`flex items-center gap-3 rounded-lg px-3 py-1.5 ${best ? "bg-pin-dim/70" : "bg-floor"}`}>
                      <span className="w-10 text-sm text-mute">Set {s.set_number}</span>
                      <span className="display flex-1 text-xl font-semibold">
                        {ex?.plates ? <span className="text-sm text-mute">plaat </span> : null}
                        {fmt(Number(s.weight_kg))}
                        {ex?.plates ? null : <span className="text-sm text-mute"> {ex?.unit ?? "kg"}</span>} × {s.reps}
                      </span>
                      <span className="text-xs text-mute">
                        {s.rir === null ? "" : s.rir === 3 ? "3+ over" : `${s.rir} over`}
                        {s.is_drop && s.drop_weight_kg ? `, drop ${fmt(Number(s.drop_weight_kg))}×${s.drop_reps}` : s.is_drop ? ", + drop" : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </article>
          );
        })}
        {workout.quick_check && <p className="card p-4 text-mute">Afgevinkt zonder sets.</p>}
        {workout.notes && (
          <p className="card p-4 text-sm">
            <span className="text-mute">Notitie: </span>
            {workout.notes}
          </p>
        )}
      </section>

      <section id="reacties" className="scroll-mt-4 space-y-3">
        <h2 className="font-semibold">Reacties</h2>
        <Reactions workoutId={id} state={reactionState(social.reactions, id, user.id)} />
        {social.reactions.length > 0 && (
          <p className="text-xs text-mute">
            {[...new Set(social.reactions.map((r) => r.user_id))].map((u) => (u === user.id ? "Jij" : nameOf(u))).join(", ")}
          </p>
        )}
        <ul className="space-y-2">
          {social.comments.map((c) => (
            <li key={c.id} className="card flex gap-2 px-3 py-2.5 text-sm">
              <div className="flex-1">
                <p>
                  <span className="font-semibold">{c.user_id === user.id ? "Jij" : <CrewName userId={c.user_id} name={nameOf(c.user_id)} />}</span>{" "}
                  <span className="text-xs text-mute">{timeAgo(c.created_at)}</span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
              </div>
              {c.user_id === user.id && (
                <form action={deleteComment.bind(null, c.id)}>
                  <button aria-label="Comment verwijderen" className="p-1 text-mute">
                    <Trash2 size={14} />
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={addComment.bind(null, id)} className="flex gap-2">
          <input
            name="body"
            required
            maxLength={500}
            autoComplete="off"
            placeholder={mine ? "Iets toevoegen…" : `Zeg iets tegen ${nameOf(workout.user_id)}…`}
            className="min-w-0 flex-1 rounded-full border border-line bg-steel px-4 py-2.5"
          />
          <SubmitButton pendingText="…" className="rounded-full bg-pin px-4 font-semibold text-chalk">
            Plaats
          </SubmitButton>
        </form>
      </section>

      {mine && (
        <div className="space-y-2 pt-2">
          {justDone && (
            <Link href="/" className="block rounded-full bg-pin py-4 text-center text-xl font-semibold text-chalk">
              Terug naar vandaag
            </Link>
          )}
          {workout.day_type !== "cardio" && (
            <Link href={`/training/${id}?bewerk=1`} className="flex items-center justify-center gap-1.5 rounded-full bg-steel py-3.5 font-semibold">
              <Pencil size={16} /> Training aanpassen
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
