import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { addDays, dayKey } from "./dates";
import type { DatedSet } from "./stats";
import type { CoachAdvice, HabitLog, Profile, SetRow, Workout } from "./types";

/** Ingelogde gebruiker, lokaal gecontroleerd via de JWT (snel, geen netwerkrondje). */
export async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const user = { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };
  return { supabase, user };
}

export async function requireMe() {
  const { supabase, user } = await requireUser();
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

/**
 * Trainingen die open zijn blijven staan (vergeten op "afronden" te drukken) worden
 * na 4 uur automatisch afgerond op het tijdstip van de laatste set. Lege trainingen
 * van meer dan een dag oud worden opgeruimd.
 */
export async function closeStaleWorkouts(supabase: Supa, userId: string) {
  const cutoff = new Date(Date.now() - 4 * 3600 * 1000).toISOString();
  const { data: open } = await supabase
    .from("workouts")
    .select("id, started_at, sets(created_at)")
    .eq("user_id", userId)
    .is("completed_at", null)
    .lt("started_at", cutoff);
  for (const w of (open ?? []) as { id: string; started_at: string; sets: { created_at: string }[] }[]) {
    const times = w.sets.map((s) => s.created_at).sort();
    const lastActivity = times.at(-1) ?? w.started_at;
    if (lastActivity > cutoff) continue; // nog bezig
    if (times.length) {
      await supabase.from("workouts").update({ started_at: times[0], completed_at: times.at(-1) }).eq("id", w.id);
    } else if (w.started_at < new Date(Date.now() - 24 * 3600 * 1000).toISOString()) {
      await supabase.from("workouts").delete().eq("id", w.id);
    }
  }
}
