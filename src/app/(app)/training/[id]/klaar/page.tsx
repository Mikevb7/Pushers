import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Pencil, Trash2, Trophy } from "lucide-react";
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
import { CrewName } from "@/components/CrewName";
import { Reactions } from "@/components/Reactions";
import { SubmitButton } from "@/components/SubmitButton";
import { DeltaBadge, fmtKg } from "@/components/WorkoutCard";

const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

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

  return (
    <div data-theme={theme ?? undefined} className={`space-y-5 pt-2 ${theme && !mine ? "-mx-4 rounded-3xl px-4 pb-4" : ""}`}>
      <Link href={mine ? "/logboek" : `/crew/${workout.user_id}`} className="inline-flex items-center gap-1.5 text-sm text-mute">
        <ArrowLeft size={16} /> {mine ? "Logboek" : nameOf(workout.user_id)}
      </Link>

      <header>
        <p className="text-mute">
          {justDone ? (
            "Klaar met"
          ) : (
            <>
              {mine ? "Jouw training" : <CrewName userId={workout.user_id} name={nameOf(workout.user_id)} />} · {formatDay(dayKey(workout.started_at))}
            </>
          )}
        </p>
        <h1 className="display flex items-center gap-3 text-[5.5rem] font-bold uppercase leading-[0.9]">
          {DAY_LABEL[workout.day_type]}
          <span className="size-4 rounded-full" style={{ background: DAY_COLOR[workout.day_type] }} aria-hidden />
        </h1>
        {workout.completed_at && <p className="mt-1 text-sm text-mute">Afgerond {timeAgo(workout.completed_at)}</p>}
      </header>

      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Tijd", summary.minutes !== null ? `${summary.minutes} min` : "–"],
          ["Sets", String(summary.setCount)],
          ["Volume", summary.volume ? fmtKg(summary.volume) : "–"],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <dt className="flex items-center gap-1 text-sm text-mute">
              {k === "Tijd" && <Clock size={13} aria-hidden />}
              {k}
            </dt>
            <dd className="display text-3xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

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
                        {ex?.plates ? null : <span className="text-sm text-mute"> kg</span>} × {s.reps}
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
