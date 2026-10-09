import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadHabits, loadSets, loadWorkouts } from "@/lib/data";
import { addDays, dayKey } from "@/lib/dates";
import { buildCoachContext, COACH_SYSTEM, COACH_TOOL, EXERCISE_CATALOG, sanitizeAdjustments } from "@/lib/coach";
import { DAY_LABEL } from "@/lib/schedule";
import { nextGymDay } from "@/lib/rotation";
import type { Profile } from "@/lib/types";

export const maxDuration = 60;

const DAILY_LIMIT = 6;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const user = auth?.claims?.sub ? { id: auth.claims.sub } : null;
  if (!user) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "De coach is nog niet ingesteld: ANTHROPIC_API_KEY ontbreekt in Vercel." }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "today" ? "today" : "weekly";

  const today = dayKey();
  const { count } = await supabase
    .from("coach_advice")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", `${today}T00:00:00`);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `Je hebt vandaag al ${DAILY_LIMIT} keer advies gevraagd. Morgen weer.` }, { status: 429 });
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) return NextResponse.json({ error: "Profiel niet gevonden" }, { status: 404 });
  const [workouts, sets, habits] = await Promise.all([
    loadWorkouts(supabase, user.id, 120),
    loadSets(supabase, user.id),
    loadHabits(supabase, user.id, 30),
  ]);

  const recentSets = sets.filter((s) => dayKey(s.date) >= addDays(today, -90));
  const context = buildCoachContext({ profile, workouts, sets: recentSets, habits, today });
  const day = nextGymDay(workouts);

  const task =
    kind === "weekly"
      ? "Maak een weekanalyse: wat gaat goed, wat blijft achter, en wat pas je deze week aan in het schema (alle 4 trainingsdagen mogen)."
      : `Geef advies voor de volgende training: ${DAY_LABEL[day]} (day = "${day}"). Doe alleen aanpassingen voor die dag. Noem per belangrijke oefening kort waar hij op moet letten.`;

  const client = new Anthropic();
  try {
    const msg = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
      max_tokens: 1500,
      system: COACH_SYSTEM,
      tools: [COACH_TOOL],
      tool_choice: { type: "tool", name: COACH_TOOL.name },
      messages: [
        {
          role: "user",
          content: `${task}\n\nOefeningencatalogus (id's die je mag gebruiken):\n${EXERCISE_CATALOG}\n\nData:\n${JSON.stringify(context)}`,
        },
      ],
    });
    const block = msg.content.find((b) => b.type === "tool_use");
    const input = (block && block.type === "tool_use" ? block.input : {}) as { samenvatting?: string; aanpassingen?: unknown };
    const summary = (input.samenvatting ?? "").trim();
    if (!summary) throw new Error("Leeg antwoord");
    const adjustments = sanitizeAdjustments(input.aanpassingen, kind === "today" ? day : undefined);

    const { data, error } = await supabase
      .from("coach_advice")
      .insert({
        kind,
        day_type: kind === "today" ? day : null,
        summary,
        adjustments,
        valid_until: kind === "weekly" ? addDays(today, 6) : addDays(today, 1),
      })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ advice: data });
  } catch (e) {
    console.error("coach error", e);
    return NextResponse.json({ error: "De coach kon nu geen advies geven. Probeer het zo nog eens." }, { status: 502 });
  }
}
