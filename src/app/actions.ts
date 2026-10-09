"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/data";
import { dayKey } from "@/lib/dates";
import { EXERCISE_MAP } from "@/lib/exercises";
import { ROTATION, type GymDay } from "@/lib/schedule";

const refresh = () => revalidatePath("/", "layout");

export async function startWorkout(day: GymDay) {
  if (!ROTATION.includes(day)) throw new Error("Onbekende training");
  const { supabase, user } = await requireUser();
  // Al een open training van vandaag? Dan die verder.
  const { data: open } = await supabase
    .from("workouts")
    .select("id, started_at")
    .eq("user_id", user.id)
    .eq("day_type", day)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  const existing = open?.find((w) => dayKey(w.started_at) === dayKey());
  if (existing) redirect(`/training/${existing.id}`);

  const { data, error } = await supabase.from("workouts").insert({ day_type: day }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "Kon training niet starten");
  redirect(`/training/${data.id}`);
}

export interface LogSetInput {
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rir: number | null;
  drop: { weight: number; reps: number } | null;
}

export async function logSet(input: LogSetInput) {
  if (!EXERCISE_MAP[input.exerciseId]) throw new Error("Onbekende oefening");
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("sets")
    .insert({
      workout_id: input.workoutId,
      exercise_id: input.exerciseId,
      set_number: input.setNumber,
      weight_kg: Math.max(0, input.weight),
      reps: Math.max(0, Math.round(input.reps)),
      rir: input.rir,
      is_drop: !!input.drop,
      drop_weight_kg: input.drop?.weight ?? null,
      drop_reps: input.drop?.reps ?? null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteSet(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("sets").delete().eq("id", id);
}

export async function finishWorkout(id: string, notes?: string) {
  const { supabase } = await requireUser();
  await supabase
    .from("workouts")
    .update({ completed_at: new Date().toISOString(), notes: notes?.trim() || null })
    .eq("id", id);
  refresh();
  redirect(`/training/${id}/klaar`);
}

export async function discardWorkout(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("workouts").delete().eq("id", id);
  refresh();
  redirect("/");
}

/** Training afvinken zonder sets te loggen. */
export async function quickCheck(day: GymDay) {
  if (!ROTATION.includes(day)) throw new Error("Onbekende training");
  const { supabase } = await requireUser();
  const now = new Date().toISOString();
  await supabase.from("workouts").insert({ day_type: day, completed_at: now, quick_check: true });
  refresh();
}

export async function addCardio(formData: FormData) {
  const { supabase } = await requireUser();
  const description = String(formData.get("description") ?? "").trim() || "Cardio";
  const minutes = Number(formData.get("minutes")) || null;
  const now = new Date().toISOString();
  await supabase.from("workouts").insert({
    day_type: "cardio",
    completed_at: now,
    cardio_description: description.slice(0, 120),
    cardio_minutes: minutes ? Math.min(600, Math.max(1, Math.round(minutes))) : null,
  });
  refresh();
}

export async function removeWorkout(id: string) {
  const { supabase } = await requireUser();
  await supabase.from("workouts").delete().eq("id", id);
  refresh();
}

export async function addWater(ml: number) {
  const { supabase, user } = await requireUser();
  const day = dayKey();
  const { data } = await supabase.from("habit_logs").select("water_ml").eq("user_id", user.id).eq("day", day).maybeSingle();
  const water = Math.min(20000, Math.max(0, (data?.water_ml ?? 0) + Math.round(ml)));
  await supabase.from("habit_logs").upsert({ user_id: user.id, day, water_ml: water }, { onConflict: "user_id,day" });
  refresh();
  return water;
}

export async function setCreatine(taken: boolean) {
  const { supabase, user } = await requireUser();
  await supabase.from("habit_logs").upsert({ user_id: user.id, day: dayKey(), creatine: taken }, { onConflict: "user_id,day" });
  refresh();
}

export async function updateProfile(formData: FormData) {
  const { supabase, user } = await requireUser();
  const num = (k: string, min: number, max: number, fallback: number) => {
    const v = Number(String(formData.get(k)).replace(",", "."));
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
  };
  await supabase
    .from("profiles")
    .update({
      display_name: String(formData.get("display_name") ?? "").trim().slice(0, 40) || "Naamloos",
      level: formData.get("level") === "gevorderd" ? "gevorderd" : "beginner",
      bodyweight_kg: num("bodyweight_kg", 30, 250, 75),
      water_goal_ml: Math.round(num("water_goal_ml", 500, 10000, 3000)),
      glass_ml: Math.round(num("glass_ml", 50, 2000, 250)),
    })
    .eq("id", user.id);
  refresh();
  redirect("/");
}

export async function signOut() {
  const { supabase } = await requireUser();
  await supabase.auth.signOut();
  redirect("/login");
}
