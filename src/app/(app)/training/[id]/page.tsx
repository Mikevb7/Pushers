import { notFound, redirect } from "next/navigation";
import { loadActiveAdvice, loadSets, requireUser } from "@/lib/data";
import { EXERCISE_MAP } from "@/lib/exercises";
import { planFor } from "@/lib/plan";
import { sessionsFor, suggest, type Suggestion } from "@/lib/progression";
import type { GymDay } from "@/lib/schedule";
import type { SetRow, Workout } from "@/lib/types";
import { TrainingSession, type ExerciseInfo } from "@/components/TrainingSession";

const fmtKg = (n: number) => String(n).replace(".", ",");

export default async function TrainingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>();
  if (!workout || workout.user_id !== user.id || workout.day_type === "cardio") notFound();
  if (workout.completed_at) redirect(`/training/${id}/klaar`);

  const day = workout.day_type as GymDay;
  const [allSets, advice] = await Promise.all([loadSets(supabase, user.id), loadActiveAdvice(supabase, user.id)]);
  const current: SetRow[] = allSets.filter((s) => s.workout_id === id);
  const history = allSets.filter((s) => s.workout_id !== id);
  const dates = Object.fromEntries(history.map((s) => [s.workout_id, s.date]));
  const { items, notes } = planFor(day, advice);

  const ids = new Set<string>();
  for (const i of items) {
    ids.add(i.exerciseId);
    EXERCISE_MAP[i.exerciseId].alternatives.forEach((a) => ids.add(a));
  }
  current.forEach((s) => ids.add(s.exercise_id));

  const info: Record<string, ExerciseInfo> = {};
  for (const exId of ids) {
    const ex = EXERCISE_MAP[exId];
    if (!ex) continue;
    const base = items.find((i) => i.exerciseId === exId) ?? items.find((i) => EXERCISE_MAP[i.exerciseId].alternatives.includes(exId))!;
    const sessions = sessionsFor(exId, history.filter((s) => !s.is_drop), dates);
    const sug: Suggestion = base ? suggest(base, ex, sessions) : { kind: "first", weight: null, reps: 10, text: "" };
    const last = sessions[0];
    info[exId] = {
      suggestion: sug,
      last: last
        ? `${fmtKg(Math.max(...last.sets.map((s) => Number(s.weight_kg))))} kg × ${last.sets.map((s) => s.reps).join(", ")}`
        : null,
    };
  }

  return (
    <TrainingSession
      workoutId={id}
      day={day}
      startedAt={workout.started_at}
      items={items}
      notes={notes}
      info={info}
      logged={current}
    />
  );
}
