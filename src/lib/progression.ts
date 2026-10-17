// Progressive overload: vaste regels die per oefening het volgende gewicht voorstellen.
import { formatLoad, snapToStack, stackStep, type Exercise } from "./exercises";
import { e1rm } from "./stats";
import type { PlanItem } from "./schedule";
import type { SetRow } from "./types";

export interface Session {
  workoutId: string;
  date: string; // ISO
  sets: SetRow[]; // hoofdsets (de dropset hangt eraan als extra info)
}

export type SuggestionKind = "first" | "increase" | "hold" | "stall";

export interface Suggestion {
  kind: SuggestionKind;
  weight: number | null;
  reps: number;
  text: string;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Groepeer sets van één oefening per training, nieuwste eerst. */
export function sessionsFor(exerciseId: string, sets: SetRow[], workoutDates: Record<string, string>): Session[] {
  const byWorkout = new Map<string, SetRow[]>();
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue;
    const list = byWorkout.get(s.workout_id) ?? [];
    list.push(s);
    byWorkout.set(s.workout_id, list);
  }
  return [...byWorkout.entries()]
    .map(([workoutId, list]) => ({
      workoutId,
      date: workoutDates[workoutId] ?? list[0].created_at,
      sets: list.sort((a, b) => a.set_number - b.set_number),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function topWeight(sets: SetRow[]): number {
  return Math.max(...sets.map((s) => Number(s.weight_kg)));
}

function bestRepsAt(sets: SetRow[], w: number): number {
  return Math.max(0, ...sets.filter((s) => Number(s.weight_kg) === w).map((s) => s.reps));
}

export function suggest(item: PlanItem, ex: Exercise, history: Session[]): Suggestion {
  const kg = (n: number) => formatLoad(ex.id, n);
  const unit = ex.load === "lichaamsgewicht" ? "extra" : ex.exclBar ? "zonder stang" : ex.load === "dumbbell" ? "per dumbbell" : "";
  if (history.length === 0 || history[0].sets.length === 0) {
    return {
      kind: "first",
      weight: null,
      reps: item.repMax - 2,
      text:
        ex.load === "lichaamsgewicht"
          ? `Eerste keer: zoveel mogelijk nette reps, nog 1-2 over.`
          : ex.plates
          ? `Eerste keer: kies een plaat (pin 1-16) waarmee je ±${item.repMax - 2} reps haalt en er nog 1-2 over hebt.`
          : `Eerste keer: kies een gewicht waarmee je ±${item.repMax - 2} reps haalt en er nog 1-2 over hebt.`,
    };
  }

  const bodyweight = ex.load === "lichaamsgewicht";
  const est = (x: SetRow) => e1rm(Number(x.weight_kg), x.reps, ex);

  // Uitschieter: een training die ineens >50% sterker is dan de keer ervoor (bijv. verkeerde
  // oefening gelogd) gebruiken we niet als basis. Dan rekenen we met de training daarvoor.
  let ref = history[0];
  if (history.length >= 2 && !bodyweight) {
    const a = Math.max(...history[0].sets.map(est));
    const b = Math.max(...history[1].sets.map(est));
    if (b > 0 && a > b * 1.5) ref = history[1];
  }
  const last = ref.sets;

  // Beste set (geschatte max) is de basis, niet de eerste of lichtste set.
  // Van de sets die (bijna) je beste waren, telt de zwaarste. Zo wint 77 × 10 van 70 × 15:
  // je zit al op 77, dus daar bouw je verder.
  const bestEst = Math.max(...last.map(est));
  const top = last
    .filter((x) => est(x) >= bestEst * 0.93)
    .reduce((a, b) => (Number(b.weight_kg) > Number(a.weight_kg) || (Number(b.weight_kg) === Number(a.weight_kg) && b.reps > a.reps) ? b : a));
  const w = Number(top.weight_kg);
  const atW = last.filter((x) => Number(x.weight_kg) === w);
  const expected = Math.min(item.sets, last.length);
  const allTop = atW.length >= expected && atW.every((x) => x.reps >= item.repMax);
  const aboveRange = top.reps > item.repMax;
  // Opbouwsets (lichter dan je beste set) tellen niet mee; zat je beste set op de top van de range
  // en waren de rest alleen opbouw, dan ook omhoog.
  const rampedToTop = top.reps >= item.repMax && atW.every((x) => x.reps >= item.repMax);
  const tooEasy = last.every((x) => x.rir !== null && x.rir >= 3) && last.every((x) => x.reps >= item.repMin);

  /** Gewicht voor `reps` herhalingen op basis van je geschatte max, in stappen van het apparaat. */
  const weightFor = (reps: number, dir: "up" | "down") => {
    const target = est(top) / (1 + reps / 30);
    if (ex.stack?.length) {
      // Echte gewichten op het blok: minstens 1 stap, hooguit 2 (blokken springen soms flink).
      const base = ex.stack.indexOf(snapToStack(ex, w));
      const nearest = ex.stack.indexOf(snapToStack(ex, target)) - base;
      const n = dir === "up" ? Math.min(Math.max(nearest, 1), 2) : Math.max(Math.min(nearest, -1), -2);
      return stackStep(ex, w, n);
    }
    let k = Math.round((target - w) / ex.increment);
    if (dir === "up") k = Math.min(Math.max(k, 1), Math.max(1, Math.floor((w * 0.1) / ex.increment)));
    else k = Math.max(Math.min(k, -1), -Math.max(1, Math.floor((w * 0.2) / ex.increment)));
    return round(Math.max(ex.increment, w + k * ex.increment));
  };
  const repsAt = (weight: number) =>
    Math.min(item.repMax, Math.max(item.repMin, Math.round(30 * (est(top) / weight - 1))));

  const atStackMax = !!ex.stack?.length && snapToStack(ex, w) === ex.stack[ex.stack.length - 1];
  if (!bodyweight && atStackMax && (allTop || aboveRange || rampedToTop || tooEasy)) {
    return {
      kind: "hold",
      weight: snapToStack(ex, w),
      reps: Math.min(item.repMax + 5, top.reps + 1),
      text: `Je zit op het zwaarste gewicht van het blok (${kg(snapToStack(ex, w))}). Ga voor meer reps, 3 tellen omlaag, of kies via "Ander apparaat" een zwaardere variant.`,
    };
  }
  if (!bodyweight && (allTop || aboveRange || rampedToTop || tooEasy)) {
    const next = weightFor(item.repMin + 1, "up");
    const why = aboveRange
      ? `Vorige keer ${kg(w)} × ${top.reps}, boven je range van ${item.repMin}-${item.repMax}.`
      : allTop || rampedToTop
        ? `Vorige keer ${item.repMax}+ reps op ${kg(w)}.`
        : `Vorige keer had je nog 3+ reps over.`;
    // Hoeveel reps haal je naar verwachting op de volgende stap? Bij grote sprongen op een blok
    // (bijv. 9 -> 14 kg) is dat flink minder. Dan eerst meer reps op je huidige gewicht.
    const realW = snapToStack(ex, w);
    // Reps tot falen = gedane reps + wat je nog over had (RIR).
    const capacity = e1rm(Number(top.weight_kg), top.reps + (top.rir ?? 0), ex);
    const expectReps = ex.plates ? item.repMin : Math.round(30 * (capacity / next - 1));
    const jumpPct = Math.round((next / realW - 1) * 100);
    if (expectReps < item.repMin - 2 && top.reps < item.repMax + 5) {
      const goal = Math.min(item.repMax + 5, Math.max(top.reps + 1, item.repMax + 1));
      return {
        kind: "hold",
        weight: realW,
        reps: goal,
        text: `De volgende stap op dit blok is ${kg(next)} (+${jumpPct}%), dat is een grote sprong. Pak eerst ${goal} reps op ${kg(realW)}, dan ga je omhoog.`,
      };
    }
    const reps = repsAt(next);
    const bigJump = expectReps < item.repMin && jumpPct >= 15;
    return {
      kind: "increase",
      weight: next,
      reps,
      text: bigJump
        ? `${why} Omhoog naar ${kg(next)}${unit ? ` ${unit}` : ""} (+${jumpPct}%, grote stap op dit blok). Reken op ±${Math.max(1, expectReps)} reps en bouw weer op.`
        : `${why} Omhoog naar ${kg(next)}${unit ? ` ${unit}` : ""} voor ±${reps} reps.`,
    };
  }
  if (bodyweight && (allTop || tooEasy)) {
    const next = round(w + ex.increment);
    return {
      kind: "increase",
      weight: next,
      reps: item.repMin,
      text: `Vorige keer ${item.repMax}+ reps. Doe er ${kg(next)} ${unit} bij.`,
    };
  }

  // Te zwaar: je beste set zat onder je range. Iets lichter, zodat je weer in de range komt.
  // Net onder je range (1-2 reps): blijf erop en haal de onderkant van de range.
  if (!bodyweight && top.reps < item.repMin && top.reps >= item.repMin - 2) {
    const real = snapToStack(ex, w);
    return {
      kind: "hold",
      weight: real,
      reps: item.repMin,
      text: `Vorige keer ${kg(w)} × ${top.reps}, net onder je range. Blijf op ${kg(real)}${unit ? ` ${unit}` : ""} en ga voor ${item.repMin} reps.`,
    };
  }
  if (!bodyweight && top.reps < item.repMin) {
    const lighter = weightFor(item.repMin + 1, "down");
    return {
      kind: "hold",
      weight: lighter,
      reps: repsAt(lighter),
      text: `Vorige keer ${kg(w)} × ${top.reps}, onder je range. Ga naar ${kg(lighter)}${unit ? ` ${unit}` : ""} voor ±${repsAt(lighter)} reps.`,
    };
  }

  const best = bestRepsAt(last, w);
  const target = Math.min(item.repMax, Math.max(item.repMin, best + 1));

  // Stilstand: 3 trainingen hetzelfde gewicht zonder meer reps
  if (history.length >= 3) {
    const recent = history.slice(0, 3);
    const sameWeight = recent.every((h) => h.sets.length && topWeight(h.sets) === w);
    const reps = recent.map((h) => bestRepsAt(h.sets, w));
    if (sameWeight && reps[0] <= reps[2]) {
      return {
        kind: "stall",
        weight: snapToStack(ex, w),
        reps: target,
        text: `Staat al 3 trainingen stil op ${kg(w)}. Ga echt tot 0-1 rep over, of check je slaap en eten.`,
      };
    }
  }

  // Gelogd gewicht dat niet op het blok staat (bijv. 30 op een Impulse): pak het dichtstbijzijnde echte gewicht.
  const real = snapToStack(ex, w);
  if (real !== w) {
    return {
      kind: "hold",
      weight: real,
      reps: target,
      text: `Op dit apparaat is het ${kg(real)} (vorige keer ${kg(w)} gelogd). Ga voor ${target} reps.`,
    };
  }
  return {
    kind: "hold",
    weight: w,
    reps: target,
    text: `Blijf op ${kg(w)}${unit ? ` ${unit}` : ""} en ga voor ${target} reps (vorige keer ${best}).`,
  };
}

