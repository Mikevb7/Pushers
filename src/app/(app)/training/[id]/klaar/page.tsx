import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trophy } from "lucide-react";
import { loadSets, requireMe } from "@/lib/data";
import { EXERCISE_MAP, formatLoad } from "@/lib/exercises";
import { DAY_LABEL } from "@/lib/schedule";
import { findPRs } from "@/lib/stats";
import type { Workout } from "@/lib/types";

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export default async function DonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, profile } = await requireMe();
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>();
  if (!workout || workout.user_id !== user.id) notFound();

  const all = await loadSets(supabase, user.id);
  const sets = all.filter((s) => s.workout_id === id);
  const prs = findPRs(all, { [user.id]: profile.bodyweight_kg }).filter((p) => p.workoutId === id);
  const volume = sets.reduce((a, s) => a + Number(s.weight_kg) * s.reps, 0);
  const minutes = workout.completed_at
    ? Math.round((new Date(workout.completed_at).getTime() - new Date(workout.started_at).getTime()) / 60000)
    : null;
  const byExercise = [...new Set(sets.map((s) => s.exercise_id))];

  return (
    <div className="space-y-6 pt-6">
      <div>
        <p className="text-mute">Klaar met</p>
        <h1 className="display text-[6rem] font-bold uppercase">{DAY_LABEL[workout.day_type]}</h1>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {[
          ["Sets", String(sets.length)],
          ["Volume", `${fmt(volume / 1000)} t`],
          ["Tijd", minutes !== null ? `${minutes} min` : "–"],
        ].map(([k, v]) => (
          <div key={k} className="card p-3">
            <dt className="text-sm text-mute">{k}</dt>
            <dd className="display text-3xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      {prs.length > 0 && (
        <section className="rounded-xl border border-pin/50 bg-pin-dim/30 p-4">
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

      <section className="space-y-2">
        {byExercise.map((exId) => (
          <div key={exId} className="flex justify-between gap-3 rounded-lg bg-steel px-3 py-2.5 text-sm">
            <span>{EXERCISE_MAP[exId]?.name ?? exId}</span>
            <span className="text-right text-mute">
              {sets
                .filter((s) => s.exercise_id === exId)
                .map((s) => `${fmt(Number(s.weight_kg))}×${s.reps}`)
                .join("  ")}
            </span>
          </div>
        ))}
        {workout.quick_check && <p className="text-mute">Afgevinkt zonder sets.</p>}
      </section>

      <div className="space-y-2">
        <Link href="/" className="block rounded-full bg-pin py-4 text-center text-xl font-semibold text-chalk">
          Terug naar vandaag
        </Link>
        {workout.day_type !== "cardio" && (
          <Link href={`/training/${id}?bewerk=1`} className="flex items-center justify-center gap-1.5 rounded-full bg-steel py-3.5 font-semibold">
            <Pencil size={16} /> Training aanpassen
          </Link>
        )}
      </div>
    </div>
  );
}
