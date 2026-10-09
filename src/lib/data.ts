import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { addDays, dayKey } from "./dates";
import type { DatedSet } from "./stats";
import type { CoachAdvice, HabitLog, Profile, SetRow, Workout } from "./types";

export async function requireMe() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  return { supabase, user, profile };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

type SetWithWorkout = SetRow & { workouts: { started_at: string } | null };

function toDated(rows: SetWithWorkout[]): DatedSet[] {
  return rows.map(({ workouts, ...s }) => ({
    ...s,
    weight_kg: Number(s.weight_kg),
    date: workouts?.started_at ?? s.created_at,
  }));
}

export async function loadWorkouts(supabase: Supa, userId?: string, sinceDays?: number): Promise<Workout[]> {
  let q = supabase.from("workouts").select("*").order("started_at", { ascending: false });
  if (userId) q = q.eq("user_id", userId);
  if (sinceDays) q = q.gte("started_at", addDays(dayKey(), -sinceDays));
  const { data } = await q.limit(2000);
  return (data ?? []) as Workout[];
}

export async function loadSets(supabase: Supa, userId?: string): Promise<DatedSet[]> {
  let q = supabase.from("sets").select("*, workouts!inner(started_at)").order("created_at", { ascending: true });
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q.limit(20000);
  return toDated((data ?? []) as SetWithWorkout[]);
}

export async function loadHabits(supabase: Supa, userId?: string, sinceDays = 120): Promise<HabitLog[]> {
  let q = supabase.from("habit_logs").select("*").gte("day", addDays(dayKey(), -sinceDays));
  if (userId) q = q.eq("user_id", userId);
  const { data } = await q;
  return (data ?? []) as HabitLog[];
}

export async function loadProfiles(supabase: Supa): Promise<Profile[]> {
  const { data } = await supabase.from("profiles").select("*").order("display_name");
  return (data ?? []) as Profile[];
}

export async function loadActiveAdvice(supabase: Supa, userId: string): Promise<CoachAdvice[]> {
  const { data } = await supabase
    .from("coach_advice")
    .select("*")
    .eq("user_id", userId)
    .gte("valid_until", dayKey())
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as CoachAdvice[];
}

export async function loadLatestAdvice(supabase: Supa, userId: string): Promise<CoachAdvice[]> {
  const { data } = await supabase
    .from("coach_advice")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data ?? []) as CoachAdvice[];
}
