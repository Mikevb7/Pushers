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

export const DAY_LABEL: Record<DayType, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  cardio: "Cardio",
};

export const GYM_SESSIONS_PER_WEEK = 4;
