// Het vaste basisschema: Push / Pull / Legs / Upper, in rotatie.

export type GymDay = "push" | "pull" | "legs" | "upper";
export type DayType = GymDay | "cardio";

export const ROTATION: GymDay[] = ["push", "pull", "legs", "upper"];

export interface PlanItem {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  superset?: string; // zelfde letter = direct na elkaar
  tip?: string; // korte uitleg in de training, bijv. "2 tellen pauze onderin"
}

export interface DayPlan {
  id: GymDay;
  name: string;
  focus: string;
  items: PlanItem[];
}

export const PLAN: Record<GymDay, DayPlan> = {
  push: {
    id: "push",
    name: "Push",
    focus: "Borst, schouders, triceps",
    items: [
      { exerciseId: "incline-smith", sets: 3, repMin: 6, repMax: 10 },
      { exerciseId: "chest-press", sets: 3, repMin: 8, repMax: 12 },
      { exerciseId: "shoulder-press", sets: 3, repMin: 8, repMax: 12 },
      { exerciseId: "cable-lateral", sets: 3, repMin: 12, repMax: 15 },
      { exerciseId: "pec-deck", sets: 3, repMin: 10, repMax: 15 },
      { exerciseId: "rope-pushdown", sets: 3, repMin: 10, repMax: 15 },
      { exerciseId: "cable-overhead-ext", sets: 2, repMin: 10, repMax: 15 },
    ],
  },
  pull: {
    id: "pull",
    name: "Pull",
    focus: "Rug, achterkant schouders, biceps",
    items: [
      { exerciseId: "lat-pulldown", sets: 3, repMin: 8, repMax: 12 },
      { exerciseId: "chest-supported-row", sets: 3, repMin: 8, repMax: 12 },
      { exerciseId: "evolve-mid-row", sets: 3, repMin: 10, repMax: 12 },
      { exerciseId: "rear-delt-fly", sets: 3, repMin: 12, repMax: 15 },
      { exerciseId: "bayesian-curl", sets: 3, repMin: 10, repMax: 12 },
      { exerciseId: "machine-arm-curl", sets: 2, repMin: 10, repMax: 15 },
      { exerciseId: "back-extension", sets: 2, repMin: 12, repMax: 15 },
    ],
  },
  legs: {
    id: "legs",
    name: "Legs",
    focus: "Benen en buik",
    items: [
      { exerciseId: "leg-press", sets: 4, repMin: 8, repMax: 12 },
      { exerciseId: "seated-leg-curl", sets: 3, repMin: 10, repMax: 12 },
      { exerciseId: "leg-extension", sets: 3, repMin: 10, repMax: 15 },
      { exerciseId: "standing-glute", sets: 3, repMin: 10, repMax: 12 },
      { exerciseId: "calf-raise", sets: 3, repMin: 12, repMax: 15 },
      { exerciseId: "adductor", sets: 2, repMin: 12, repMax: 15 },
      { exerciseId: "captains-leg-raise", sets: 3, repMin: 10, repMax: 15 },
      { exerciseId: "ab-crunch-machine", sets: 3, repMin: 12, repMax: 15 },
    ],
  },
  upper: {
    id: "upper",
    name: "Upper",
    focus: "Hele bovenlichaam en buik",
    items: [
      { exerciseId: "bench-press", sets: 3, repMin: 6, repMax: 10 },
      { exerciseId: "pull-up", sets: 3, repMin: 6, repMax: 10 },
      { exerciseId: "incline-db-press", sets: 2, repMin: 8, repMax: 12 },
      { exerciseId: "one-arm-db-row", sets: 3, repMin: 8, repMax: 12 },
      { exerciseId: "cable-fly", sets: 2, repMin: 12, repMax: 15, superset: "A" },
      { exerciseId: "db-lateral", sets: 2, repMin: 12, repMax: 15, superset: "A" },
      { exerciseId: "dips", sets: 2, repMin: 8, repMax: 12, superset: "B" },
      { exerciseId: "hammer-curl", sets: 2, repMin: 10, repMax: 12, superset: "B" },
      { exerciseId: "rope-crunch", sets: 2, repMin: 12, repMax: 15 },
    ],
  },
};

/**
 * Kort schema met bench-focus: 4 dagen van ±45 minuten, zwaar bankdrukken 2× per week,
 * kleine spieren in supersets bij elkaar in de buurt (zelfde kabelstation of rek).
 * Volgorde Benen → Push → Pull → Upper, zodat armen nooit 3 dagen achter elkaar komen
 * en er 48 uur tussen de twee bench-dagen zit.
 */
export const PLAN_KORT: Record<GymDay, DayPlan> = {
  legs: {
    id: "legs",
    name: "Legs",
    focus: "Benen, buik en armen",
    items: [
      { exerciseId: "leg-press", sets: 4, repMin: 8, repMax: 12 },
      { exerciseId: "seated-leg-curl", sets: 4, repMin: 10, repMax: 12 },
      { exerciseId: "leg-extension", sets: 3, repMin: 12, repMax: 15 },
      { exerciseId: "calf-raise", sets: 3, repMin: 10, repMax: 15, superset: "A" },
      { exerciseId: "ab-crunch-machine", sets: 3, repMin: 10, repMax: 15, superset: "A" },
      { exerciseId: "cable-curl-bar", sets: 2, repMin: 10, repMax: 15, superset: "B" },
      { exerciseId: "rope-pushdown", sets: 2, repMin: 10, repMax: 12, superset: "B" },
    ],
  },
  push: {
    id: "push",
    name: "Push",
    focus: "Zwaar bankdrukken, schouders, triceps",
    items: [
      { exerciseId: "bench-press", sets: 4, repMin: 4, repMax: 6, tip: "Zwaar. Haal je 4 × 6, dan volgende keer +2,5 kg. Zwaar? Laat iemand spotten." },
      { exerciseId: "incline-smith", sets: 3, repMin: 8, repMax: 10 },
      { exerciseId: "shoulder-press", sets: 2, repMin: 8, repMax: 12 },
      { exerciseId: "cable-lateral", sets: 3, repMin: 12, repMax: 15, superset: "A" },
      { exerciseId: "cable-overhead-ext", sets: 2, repMin: 10, repMax: 12, superset: "A" },
    ],
  },
  pull: {
    id: "pull",
    name: "Pull",
    focus: "Rug, achterkant schouders, biceps",
    items: [
      { exerciseId: "lat-pulldown", sets: 3, repMin: 8, repMax: 12, tip: "2 tellen pauze onderin, dan wordt het blok weer zwaar genoeg." },
      { exerciseId: "chest-supported-row", sets: 3, repMin: 8, repMax: 12 },
      { exerciseId: "evolve-mid-row", sets: 2, repMin: 10, repMax: 12 },
      { exerciseId: "cable-rear-delt-single", sets: 3, repMin: 12, repMax: 15, superset: "A" },
      { exerciseId: "bayesian-curl", sets: 3, repMin: 10, repMax: 12, superset: "A" },
    ],
  },
  upper: {
    id: "upper",
    name: "Upper",
    focus: "Bankdrukken voor volume, hele bovenlijf",
    items: [
      { exerciseId: "bench-press", sets: 3, repMin: 6, repMax: 8, tip: "Volume-dag. Haal je 3 × 8, dan volgende keer +2,5 kg." },
      { exerciseId: "pull-up", sets: 3, repMin: 6, repMax: 12 },
      { exerciseId: "pec-deck", sets: 2, repMin: 10, repMax: 15 },
      { exerciseId: "hammer-curl", sets: 2, repMin: 10, repMax: 12, superset: "A" },
      { exerciseId: "db-lateral", sets: 3, repMin: 12, repMax: 15, superset: "A" },
      { exerciseId: "dips", sets: 2, repMin: 6, repMax: 12, superset: "B" },
      { exerciseId: "captains-leg-raise", sets: 3, repMin: 10, repMax: 15, superset: "B" },
    ],
  },
};

export type ProgramId = "standaard" | "kort";

export interface Program {
  id: ProgramId;
  name: string;
  description: string;
  rotation: GymDay[];
  plan: Record<GymDay, DayPlan>;
}

export const PROGRAMS: Record<ProgramId, Program> = {
  standaard: {
    id: "standaard",
    name: "Standaard",
    description: "Push, Pull, Legs, Upper. Veel oefeningen, ±70 minuten per training.",
    rotation: ROTATION,
    plan: PLAN,
  },
  kort: {
    id: "kort",
    name: "Kort en zwaar (bench-focus)",
    description: "Legs, Push, Pull, Upper. ±45 minuten, 2× per week zwaar bankdrukken, supersets.",
    rotation: ["legs", "push", "pull", "upper"],
    plan: PLAN_KORT,
  },
};

export const programOf = (id: string | null | undefined): Program => PROGRAMS[(id as ProgramId) ?? "standaard"] ?? PROGRAMS.standaard;

export const DAY_LABEL: Record<DayType, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  cardio: "Cardio",
};

export const GYM_SESSIONS_PER_WEEK = 4;
