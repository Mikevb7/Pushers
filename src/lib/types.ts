import type { DayType, GymDay } from "./schedule";

export interface Profile {
  id: string;
  display_name: string;
  level: "beginner" | "gevorderd";
  bodyweight_kg: number;
  water_goal_ml: number;
  glass_ml: number;
  creatine_g: number;
  created_at: string;
}

export interface Workout {
  id: string;
  user_id: string;
  day_type: DayType;
  started_at: string;
  completed_at: string | null;
  quick_check: boolean;
  cardio_description: string | null;
  cardio_minutes: number | null;
  notes: string | null;
}

export interface SetRow {
  id: string;
  workout_id: string;
  user_id: string;
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  rir: number | null;
  is_drop: boolean;
  drop_weight_kg: number | null;
  drop_reps: number | null;
  created_at: string;
}

export interface HabitLog {
  user_id: string;
  day: string; // YYYY-MM-DD
  water_ml: number;
  creatine: boolean;
}

export type Adjustment =
  | { type: "add_set"; day: GymDay; exerciseId: string; reason?: string }
  | { type: "remove_set"; day: GymDay; exerciseId: string; reason?: string }
  | { type: "swap"; day: GymDay; exerciseId: string; toExerciseId: string; reason?: string }
  | { type: "note"; day: GymDay; exerciseId?: string; note: string };

export interface CoachAdvice {
  id: string;
  user_id: string;
  created_at: string;
  kind: "weekly" | "today";
  day_type: string | null;
  summary: string;
  adjustments: Adjustment[];
  valid_until: string;
}
