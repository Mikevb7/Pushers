import Link from "next/link";
import { loadProfiles, loadSets, requireMe } from "@/lib/data";
import { addDays, dayKey, formatDay } from "@/lib/dates";
import { EXERCISE_MAP, MUSCLE_LABEL, formatLoad } from "@/lib/exercises";
import {
  exerciseIdsIn,
  exerciseProgress,
  exerciseSeries,
  formatPct,
  muscleProgress,
  overallProgress,
  weeklySets,
  type Period,
} from "@/lib/stats";
import { ProgressChart } from "@/components/ProgressChart";
import { CrewName } from "@/components/CrewName";
import { themeFor } from "@/lib/themes";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "maand", label: "Maand" },
  { id: "start", label: "Sinds start" },
];


export default async function ProgressPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase, user } = await requireMe();
  const profiles = await loadProfiles(supabase);
  const who = profiles.find((p) => p.id === sp.user) ?? profiles.find((p) => p.id === user.id)!;
  const period = (PERIODS.find((p) => p.id === sp.periode)?.id ?? "maand") as Period;
  const sets = await loadSets(supabase, who.id);
  const today = dayKey();
  const bw = who.bodyweight_kg;

  const overall = overallProgress(sets, period, bw, today);
  const muscles = muscleProgress(sets, period, bw, today);
  const maxAbs = Math.max(5, ...muscles.map((m) => Math.abs(m.pct)));
  const exercises = exerciseIdsIn(sets)
    .map((id) => ({ id, series: exerciseSeries(sets, id, bw) }))
    // Oefeningen zonder bruikbare sets (bijv. alleen 0 reps) overslaan i.p.v. crashen
    .filter((e) => e.series.length > 0)
    .map(({ id, series }) => {
      const best = series.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), series[0]);
      const setCount = sets.filter((x) => x.exercise_id === id).length;
      return { id, series, best, setCount, pct: exerciseProgress(series, period, today), last: series[series.length - 1].date };
    })
    .sort((a, b) => b.last.localeCompare(a.last));
  const selected = exercises.find((e) => e.id === sp.oefening);
  const counted = exercises.filter((e) => e.pct !== null).length;
  const firstDay = sets.length ? sets.map((x) => dayKey(x.date)).sort()[0] : null;
  const fromDay = addDays(today, period === "week" ? -6 : -29);
  const startedInPeriod = period !== "start" && firstDay !== null && firstDay >= fromDay;
  // Alleen crewleden die echt trainen in de lijst (lege of dubbele accounts niet).
  const { data: activeRows } = await supabase.from("workouts").select("user_id").not("completed_at", "is", null);
  const active = new Set(((activeRows ?? []) as { user_id: string }[]).map((r) => r.user_id));
  const volume = weeklySets(sets, today);

  const link = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { user: who.id === user.id ? undefined : who.id, periode: period, oefening: sp.oefening, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && q.set(k, v));
    return `/progressie?${q}`;
  };
  const mine = who.id === user.id;

  const viewTheme = themeFor(who.id);
  return (
    <div data-theme={viewTheme ?? undefined} className={`space-y-6 ${viewTheme && !mine ? "-mx-4 rounded-3xl px-4 pb-4" : ""}`}>
      <header className="pt-2">
        <h1 className="display text-6xl font-bold uppercase">Progressie</h1>
      </header>

      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4" aria-label="Van wie">
        {profiles.filter((p) => p.id === user.id || p.id === who.id || active.has(p.id)).map((p) => (
          <Link
            key={p.id}
            href={link({ user: p.id === user.id ? undefined : p.id, oefening: undefined })}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold ${p.id === who.id ? "bg-chalk text-floor" : "bg-steel text-mute"}`}
          >
            {p.id === user.id ? "Ik" : <CrewName userId={p.id} name={p.display_name} />}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-3 rounded-lg bg-steel p-1">
        {PERIODS.map((p) => (
          <Link key={p.id} href={link({ periode: p.id })} className={`rounded-md py-2 text-center text-sm font-semibold ${p.id === period ? "bg-steel-2" : "text-mute"}`}>
            {p.label}
          </Link>
        ))}
      </div>

      <section>
        <p className="text-mute">
          {mine ? "Je bent" : (
            <>
              <CrewName userId={who.id} name={who.display_name} /> is
            </>
          )}{" "}
          gemiddeld
        </p>
        <p className={`display text-[6.5rem] font-bold ${overall !== null && overall > 0 ? "text-go" : ""}`}>{formatPct(overall)}</p>
        <p className="text-mute">
          {overall === null
            ? period === "start"
              ? "Doe elke oefening minstens twee keer om dit te zien."
              : `Nog niet genoeg trainingen om deze ${period} te vergelijken.`
            : startedInPeriod || period === "start"
              ? `sterker dan bij je eerste keer, gemiddeld over ${counted} ${counted === 1 ? "oefening" : "oefeningen"}.`
              : `sterker dan je beste vóór deze ${period}, gemiddeld over ${counted} ${counted === 1 ? "oefening" : "oefeningen"}.`}
        </p>
        {startedInPeriod && overall !== null && (
          <p className="mt-2 rounded-lg bg-steel px-3 py-2 text-sm text-mute">
            Je traint pas sinds {formatDay(firstDay!)}, dus Week, Maand en Sinds start vergelijken bijna hetzelfde: je eerste keer met nu. Na een paar weken gaan ze echt verschillen.
          </p>
        )}
      </section>

      {muscles.length > 0 && (
        <section>
          <h2 className="font-semibold">Per spiergroep</h2>
          <p className="mb-3 text-xs text-mute">
            Gemeten met je geschatte max: gewicht én reps samen. 50 kg × 12 telt dus zwaarder dan 50 kg × 8.
          </p>
          <ul className="space-y-2">
            {muscles.map((m) => (
              <li key={m.muscle} className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-2 text-sm">
                <span>{MUSCLE_LABEL[m.muscle]}</span>
                <span className="relative h-3 rounded-full bg-line/70">
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full ${m.pct >= 0 ? "bg-pin" : "bg-warn"}`}
                    style={{ width: `${(Math.abs(m.pct) / maxAbs) * 100}%` }}
                  />
                </span>
                <span className="text-right font-semibold">{formatPct(m.pct)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <section className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{EXERCISE_MAP[selected.id].name}</h2>
              <p className="text-sm text-mute">
                Beste set: {formatLoad(selected.id, selected.best.weight)} × {selected.best.reps}
              </p>
            </div>
            <Link href={link({ oefening: undefined })} className="text-sm text-mute">
              Sluiten
            </Link>
          </div>
          <ProgressChart points={selected.series.map((p) => ({ date: p.date, e1rm: p.e1rm, label: `${formatLoad(selected.id, p.weight)} × ${p.reps}` }))} />
        </section>
      )}

      <section>
        <h2 className="mb-3 font-semibold">Per oefening</h2>
        {exercises.length === 0 ? (
          <p className="card p-4 text-sm text-mute">{mine ? "Log je eerste training, dan verschijnen je oefeningen hier." : "Nog geen trainingen gelogd."}</p>
        ) : (
          <ul className="space-y-1.5">
            {exercises.map((e) => (
              <li key={e.id}>
                <Link
                  href={link({ oefening: e.id })}
                  scroll={false}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${e.id === sp.oefening ? "bg-steel-2" : "bg-steel"}`}
                >
                  <span className="flex-1">
                    <span className="block font-medium">{EXERCISE_MAP[e.id].name}</span>
                    <span className="text-sm text-mute">
                      Beste set {formatLoad(e.id, e.best.weight)} × {e.best.reps}
                      <br />
                      {e.series.length} {e.series.length === 1 ? "training" : "trainingen"}, {e.setCount} sets
                    </span>
                  </span>
                  {e.series.length < 2 ? (
                    <span className="rounded-full bg-pin-dim px-2.5 py-1 text-xs font-semibold text-pin-deep">Eerste keer</span>
                  ) : (
                    <span className={`display text-2xl font-bold ${e.pct !== null && e.pct > 0 ? "text-go" : e.pct !== null && e.pct < 0 ? "text-warn" : "text-mute"}`}>
                      {formatPct(e.pct)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {Object.keys(volume).length > 0 && (
        <section>
          <h2 className="font-semibold">Harde sets afgelopen 7 dagen</h2>
          <p className="mb-3 text-sm text-mute">Voor groei zit je goed rond 10-20 sets per spiergroep per week.</p>
          <ul className="grid grid-cols-2 gap-1.5">
            {Object.entries(volume)
              .sort((a, b) => b[1]! - a[1]!)
              .map(([m, n]) => (
                <li key={m} className="flex justify-between rounded-lg bg-steel px-3 py-2 text-sm">
                  <span>{MUSCLE_LABEL[m as keyof typeof MUSCLE_LABEL]}</span>
                  <span className="font-semibold">{n}</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
