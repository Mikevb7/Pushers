import { loadLatestAdvice, loadWorkouts, requireMe } from "@/lib/data";
import { dayKey, timeAgo } from "@/lib/dates";
import { EXERCISE_MAP } from "@/lib/exercises";
import { DAY_LABEL } from "@/lib/schedule";
import { nextGymDay } from "@/lib/rotation";
import type { Adjustment, CoachAdvice } from "@/lib/types";
import { CoachButtons } from "@/components/CoachButtons";

function describe(a: Adjustment): string {
  const name = (id?: string) => (id ? (EXERCISE_MAP[id]?.name ?? id) : "");
  switch (a.type) {
    case "add_set":
      return `${name(a.exerciseId)}: 1 set erbij`;
    case "remove_set":
      return `${name(a.exerciseId)}: 1 set minder`;
    case "swap":
      return `${name(a.exerciseId)} wordt ${name(a.toExerciseId)}`;
    case "note":
      return a.note;
  }
}

function Summary({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.every((l) => /^\s*[-•]/.test(l)))
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {lines.map((l) => (
                <li key={l}>{l.replace(/^\s*[-•]\s*/, "")}</li>
              ))}
            </ul>
          );
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

function AdviceCard({ a, active }: { a: CoachAdvice; active: boolean }) {
  const byDay = Object.entries(
    a.adjustments.reduce<Record<string, Adjustment[]>>((acc, adj) => {
      (acc[adj.day] ??= []).push(adj);
      return acc;
    }, {}),
  );
  return (
    <article className={`rounded-xl p-4 ${active ? "bg-steel" : "bg-steel/50 text-mute"}`}>
      <p className="mb-2 text-sm text-mute">
        {a.kind === "weekly" ? "Weekanalyse" : `Advies voor ${DAY_LABEL[a.day_type as keyof typeof DAY_LABEL] ?? "vandaag"}`}, {timeAgo(a.created_at)}
        {!active && " (verlopen)"}
      </p>
      <Summary text={a.summary} />
      {byDay.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-line pt-3">
          <p className="text-sm font-semibold">{active ? "Staat in je schema" : "Aanpassingen"}</p>
          {byDay.map(([day, adjs]) => (
            <div key={day} className="text-sm">
              <span className="font-semibold">{DAY_LABEL[day as keyof typeof DAY_LABEL]}: </span>
              {adjs.map(describe).join("; ")}
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

export default async function CoachPage() {
  const { supabase, user } = await requireMe();
  const [advice, workouts] = await Promise.all([loadLatestAdvice(supabase, user.id), loadWorkouts(supabase, user.id, 30)]);
  const today = dayKey();
  const next = nextGymDay(workouts);
  const gymCount = workouts.filter((w) => w.completed_at && w.day_type !== "cardio" && !w.quick_check).length;

  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold">Coach</h1>
        <p className="mt-2 text-mute">
          Kijkt naar je kilo&apos;s, reps en hoeveel je over had, en past je schema aan waar je achterloopt. Het basisschema blijft staan.
        </p>
      </header>

      {gymCount < 3 && (
        <p className="rounded-lg border border-line px-3 py-2.5 text-sm text-mute">
          Na een paar gelogde trainingen wordt het advies veel beter. Nu is er nog weinig om naar te kijken.
        </p>
      )}

      <CoachButtons nextDayLabel={DAY_LABEL[next]} />

      <section className="space-y-3">
        {advice.length === 0 ? (
          <p className="rounded-xl bg-steel p-4 text-sm text-mute">Nog geen advies. Vraag je eerste analyse aan.</p>
        ) : (
          advice.map((a) => <AdviceCard key={a.id} a={a} active={a.valid_until >= today} />)
        )}
      </section>
    </div>
  );
}
