import { notFound, redirect } from "next/navigation";
import { loadActiveAdvice, loadSets, loadWorkouts, requireUser } from "@/lib/data";
import { EXERCISES, EXERCISE_MAP, formatLoad, optionsFor } from "@/lib/exercises";
import { bonusItem, planFor } from "@/lib/plan";
import { lastSessionSets } from "@/lib/history";
import { sessionsFor, suggest, type Suggestion } from "@/lib/progression";
import type { GymDay } from "@/lib/schedule";
import type { SetRow, Workout } from "@/lib/types";
import { TrainingSession, type ExerciseInfo } from "@/components/TrainingSession";


export default async function TrainingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ bewerk?: string }>;
}) {
  const { id } = await params;
  const editMode = (await searchParams).bewerk === "1";
  const { supabase, user } = await requireUser();
  const { data: workout } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle<Workout>();
  if (!workout || workout.user_id !== user.id || workout.day_type === "cardio") notFound();
  if (workout.completed_at && !editMode) redirect(`/training/${id}/klaar`);

  const day = workout.day_type as GymDay;
  const [allSets, advice, workouts] = await Promise.all([
    loadSets(supabase, user.id),
    loadActiveAdvice(supabase, user.id),
    loadWorkouts(supabase, user.id, 180),
  ]);
  const current: SetRow[] = allSets.filter((s) => s.workout_id === id);
  const history = allSets.filter((s) => s.workout_id !== id);
  const dates = Object.fromEntries(history.map((s) => [s.workout_id, s.date]));
  const plan = planFor(day, advice, workout.program);
  const notes = plan.notes;
  // Gelogde oefeningen die bij geen enkele plek in het schema horen = bonusoefeningen.
  // Zelfde regel als in de training: per plek telt de eerste variant met gelogde sets.
  const plannedIds = new Set(plan.items.map((i) => i.exerciseId));
  const covered = new Set(
    plan.items.map(
      (i) =>
        optionsFor(i.exerciseId)
          .filter((o) => o === i.exerciseId || !plannedIds.has(o))
          .find((o) => current.some((s) => s.exercise_id === o)) ?? i.exerciseId,
    ),
  );
  const bonusIds = [...new Set(current.map((s) => s.exercise_id))].filter((e) => !covered.has(e) && EXERCISE_MAP[e]);
  const items = [
    ...plan.items,
    ...bonusIds.map((e) => bonusItem(e, Math.max(3, current.filter((s) => s.exercise_id === e).length))),
  ];

  // Onthoud per oefening welk apparaat/welke variant je de vorige keer op deze dag koos.
  // Alleen trainingen met hetzelfde schema: anders "onthoudt" een nieuw schema keuzes uit het oude.
  const sameProgram = (w: Workout) => (w.program ?? "standaard") === (workout.program ?? "standaard");
  const sameDay = new Set(workouts.filter((w) => w.day_type === day && w.id !== id && sameProgram(w)).map((w) => w.id));
  const planned = new Set(items.map((i) => i.exerciseId));
  const preferred: Record<number, string> = {};
  plan.items.forEach((it, idx) => {
    const options = optionsFor(it.exerciseId).filter((o) => o === it.exerciseId || !planned.has(o));
    const last = [...history].reverse().find((s) => sameDay.has(s.workout_id) && options.includes(s.exercise_id));
    if (last && last.exercise_id !== it.exerciseId) preferred[idx] = last.exercise_id;
  });

  // Info voor álle oefeningen: je kunt er elk moment een als bonus toevoegen.
  const ids = new Set<string>(EXERCISES.map((e) => e.id));

  const info: Record<string, ExerciseInfo> = {};
  for (const exId of ids) {
    const ex = EXERCISE_MAP[exId];
    if (!ex) continue;
    const base = items.find((i) => i.exerciseId === exId) ?? items.find((i) => optionsFor(i.exerciseId).includes(exId)) ?? bonusItem(exId);
    const sessions = sessionsFor(exId, history, dates);
    const sug: Suggestion = base ? suggest(base, ex, sessions) : { kind: "first", weight: null, reps: 10, text: "" };
    const last = sessions[0];
    info[exId] = {
      lastSets: lastSessionSets(history, exId),
      suggestion: sug,
      last: last
        ? `${formatLoad(exId, Math.max(...last.sets.map((s) => Number(s.weight_kg))))} × ${last.sets.map((s) => s.reps).join(", ")}`
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
      preferred={preferred}
      editMode={editMode}
    />
  );
}
