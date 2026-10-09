// Bouwt de context voor de AI-coach en controleert wat de coach terugstuurt.
import { EXERCISES, EXERCISE_MAP, MUSCLE_LABEL } from "./exercises";
import { PLAN, ROTATION, type GymDay } from "./schedule";
import { addDays, daysBetween, dayKey, weekStart } from "./dates";
import { sessionsFor, suggest } from "./progression";
import { exerciseIdsIn, exerciseProgress, exerciseSeries, muscleProgress, weeklySets, type DatedSet } from "./stats";
import { consecutiveGymDays, nextGymDay, weekStatus } from "./rotation";
import type { Adjustment, HabitLog, Profile, Workout } from "./types";

const r1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

export function buildCoachContext(input: {
  profile: Profile;
  workouts: Workout[];
  sets: DatedSet[];
  habits: HabitLog[];
  today?: string;
}) {
  const { profile, workouts, sets, habits } = input;
  const today = input.today ?? dayKey();
  const bw = profile.bodyweight_kg;
  const dates = Object.fromEntries(sets.map((s) => [s.workout_id, s.date]));

  const weeks = [0, 1, 2, 3].map((i) => {
    const start = addDays(weekStart(today), -7 * i);
    const st = weekStatus(workouts, start);
    return { week_van: start, gym: st.gymDone, cardio: st.cardioDone };
  });

  const exercises = exerciseIdsIn(sets).map((id) => {
    const ex = EXERCISE_MAP[id];
    const series = exerciseSeries(sets, id, bw);
    const sessions = sessionsFor(id, sets.filter((s) => !s.is_drop), dates);
    const item = ROTATION.flatMap((d) => PLAN[d].items).find((i) => i.exerciseId === id);
    return {
      id,
      naam: ex.name,
      spier: ex.muscle,
      laatste_trainingen: sessions.slice(0, 5).map((s) => ({
        datum: dayKey(s.date),
        sets: s.sets.map((x) => `${Number(x.weight_kg)}kg×${x.reps}${x.rir === null ? "" : ` (${x.rir === 3 ? "3+" : x.rir} over)`}`),
      })),
      pct_maand: r1(exerciseProgress(series, "maand", today)),
      pct_sinds_start: r1(exerciseProgress(series, "start", today)),
      status: item ? suggest(item, ex, sessions).kind : null,
    };
  });

  const last14 = habits.filter((h) => h.day >= addDays(today, -13));
  return {
    vandaag: today,
    sporter: {
      naam: profile.display_name,
      niveau: profile.level,
      weken_bezig: Math.floor(daysBetween(dayKey(profile.created_at), today) / 7),
      lichaamsgewicht_kg: bw,
    },
    doel: "Zo snel mogelijk zo veel mogelijk spiermassa (hypertrofie). 4x gym per week in rotatie Push/Pull/Legs/Upper, 1x cardio die hij zelf invult.",
    volgende_training: nextGymDay(workouts),
    dagen_achter_elkaar_getraind: consecutiveGymDays(workouts, today),
    trainingen_per_week: weeks,
    basisschema: Object.fromEntries(
      ROTATION.map((d) => [d, PLAN[d].items.map((i) => `${i.exerciseId}: ${i.sets}×${i.repMin}-${i.repMax}`)]),
    ),
    progressie_per_spiergroep_maand: muscleProgress(sets, "maand", bw, today).map((m) => ({ spier: m.muscle, pct: r1(m.pct) })),
    progressie_per_spiergroep_sinds_start: muscleProgress(sets, "start", bw, today).map((m) => ({ spier: m.muscle, pct: r1(m.pct) })),
    harde_sets_laatste_7_dagen: weeklySets(sets, today),
    oefeningen: exercises,
    notities_recent: workouts
      .filter((w) => w.notes && w.completed_at && dayKey(w.completed_at) >= addDays(today, -21))
      .map((w) => `${dayKey(w.started_at)} ${w.day_type}: ${w.notes}`),
    gewoontes_laatste_14_dagen: {
      waterdoel_gehaald: last14.filter((h) => h.water_ml >= profile.water_goal_ml).length,
      creatine_genomen: last14.filter((h) => h.creatine).length,
    },
  };
}

export const EXERCISE_CATALOG = EXERCISES.map((e) => `${e.id} (${e.name}, ${MUSCLE_LABEL[e.muscle]})`).join("\n");

export const COACH_SYSTEM = `Je bent de AI-coach in Pushers, een trainingsapp voor een groep jonge mannen (rond de 19) die samen trainen in Sportcentrum Hierden. Doel: maximale spiergroei.

Hoe je werkt:
- Je krijgt de trainingsdata van één persoon. Baseer je advies alléén op die data. Verzin geen trends die er niet in staan.
- Spreek de persoon direct aan met "je", in informeel en eerlijk Nederlands. Kort en concreet, geen motivatiepraatjes of emoji.
- Het basisschema blijft het fundament. Je mag per training maximaal 3 aanpassingen doen: een set erbij, een set eraf, een oefening wisselen, of een notitie geven.
- Wissel alleen naar oefeningen uit de catalogus (gebruik exact de id). Wissel spaarzaam: steeds wisselen maakt progressie onmeetbaar.
- Blijft een spiergroep achter (lagere % progressie, status "stall", te weinig harde sets), geef die dan iets meer volume.
- Zie je weinig "reps over" (RIR 0-1) gecombineerd met stilstand, dan is herstel eerder het probleem dan te weinig volume.
- Te weinig trainingen per week? Benoem dat eerlijk: geen schema compenseert overgeslagen trainingen.
- Weinig data (minder dan ~3 trainingen)? Zeg dat eerlijk, geef één of twee basistips en doe geen aanpassingen.
- Geen medisch advies. Bij pijn: advies om die oefening over te slaan en het te laten checken.

Antwoord altijd via de tool geef_advies.`;

export const COACH_TOOL = {
  name: "geef_advies",
  description: "Geef het advies en eventuele aanpassingen aan het schema terug.",
  input_schema: {
    type: "object" as const,
    properties: {
      samenvatting: {
        type: "string",
        description: "Het advies voor de sporter, max ~120 woorden. Mag korte alinea's of een kort lijstje met - bevatten.",
      },
      aanpassingen: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["add_set", "remove_set", "swap", "note"] },
            day: { type: "string", enum: ROTATION },
            exerciseId: { type: "string", description: "id uit het basisschema van die dag (niet nodig bij note)" },
            toExerciseId: { type: "string", description: "alleen bij swap: id uit de catalogus" },
            reason: { type: "string", description: "korte reden, max 12 woorden, getoond bij de oefening" },
            note: { type: "string", description: "alleen bij note: korte tip voor die training" },
          },
          required: ["type", "day"],
        },
      },
    },
    required: ["samenvatting", "aanpassingen"],
  },
};

/** Alleen geldige aanpassingen doorlaten. */
export function sanitizeAdjustments(raw: unknown, onlyDay?: GymDay): Adjustment[] {
  if (!Array.isArray(raw)) return [];
  const out: Adjustment[] = [];
  const perDay: Record<string, number> = {};
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const { type, day, exerciseId, toExerciseId, reason, note } = a as Record<string, unknown>;
    if (typeof day !== "string" || !ROTATION.includes(day as GymDay)) continue;
    if (onlyDay && day !== onlyDay) continue;
    if ((perDay[day] ?? 0) >= 3) continue;
    const d = day as GymDay;
    const inPlan = typeof exerciseId === "string" && PLAN[d].items.some((i) => i.exerciseId === exerciseId);
    const why = typeof reason === "string" ? reason.slice(0, 100) : undefined;
    if (type === "note" && typeof note === "string" && note.trim()) {
      out.push({ type: "note", day: d, note: note.trim().slice(0, 200) });
    } else if ((type === "add_set" || type === "remove_set") && inPlan) {
      out.push({ type, day: d, exerciseId: exerciseId as string, reason: why });
    } else if (type === "swap" && inPlan && typeof toExerciseId === "string" && EXERCISE_MAP[toExerciseId] && toExerciseId !== exerciseId) {
      out.push({ type: "swap", day: d, exerciseId: exerciseId as string, toExerciseId, reason: why });
    } else continue;
    perDay[day] = (perDay[day] ?? 0) + 1;
  }
  return out;
}
