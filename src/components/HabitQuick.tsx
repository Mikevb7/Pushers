"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Droplet, Minus, Plus } from "lucide-react";
import { addWater, setCreatine } from "@/app/actions";

interface Props {
  water: number;
  goal: number;
  glass: number;
  creatine: boolean;
  creatineG: number;
  waterStreak: number;
  creatineStreak: number;
  big?: boolean;
}

const liters = (ml: number) => (ml / 1000).toFixed(ml % 1000 === 0 ? 0 : ml % 100 === 0 ? 1 : 2).replace(".", ",");

export function HabitQuick({ water, goal, glass, creatine, creatineG, waterStreak, creatineStreak, big }: Props) {
  const [pending, start] = useTransition();
  const [ml, addMl] = useOptimistic(water, (cur, delta: number) => Math.max(0, cur + delta));
  const [crea, setCrea] = useOptimistic(creatine, (_c, v: boolean) => v);
  const [custom, setCustom] = useState("");
  const pct = Math.min(1, ml / goal);
  const reached = ml >= goal;

  const add = (delta: number) =>
    start(async () => {
      addMl(delta);
      await addWater(delta);
    });

  return (
    <div className="space-y-3">
      <div className="card p-4">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">Water</p>
          <p className="text-sm text-mute">
            {waterStreak > 0 ? `${waterStreak} ${waterStreak === 1 ? "dag" : "dagen"} op rij` : "Nog geen streak"}
          </p>
        </div>
        <div className="mt-2 flex items-end gap-1.5">
          <span className="display text-5xl font-bold">{liters(ml)}</span>
          <span className="pb-1 text-mute">/ {liters(goal)} L</span>
          {reached && <Check className="mb-1.5 ml-1 text-go" size={22} aria-label="Doel gehaald" />}
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-line/70" role="progressbar" aria-valuenow={ml} aria-valuemax={goal}>
          <div className={`h-full rounded-full transition-[width] ${reached ? "bg-go" : "bg-pin"}`} style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => add(glass)}
            disabled={pending}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-steel-2 py-3 font-semibold active:bg-line"
          >
            <Droplet size={18} /> +1 glas <span className="font-normal text-mute">{glass} ml</span>
          </button>
          <button
            onClick={() => add(-glass)}
            disabled={pending || ml === 0}
            aria-label="Glas eraf"
            className="rounded-lg bg-steel-2 px-3.5 text-mute active:bg-line disabled:opacity-40"
          >
            <Minus size={18} />
          </button>
        </div>
        {big && (
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(custom);
              if (v > 0) {
                add(Math.round(v));
                setCustom("");
              }
            }}
          >
            <input
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/\D/g, ""))}
              placeholder="Eigen hoeveelheid (ml)"
              className="min-w-0 flex-1 rounded-lg border border-line bg-floor px-3 py-2.5"
            />
            <button className="flex items-center gap-1 rounded-lg bg-steel-2 px-4 font-semibold">
              <Plus size={16} /> Toevoegen
            </button>
          </form>
        )}
      </div>

      <button
        onClick={() =>
          start(async () => {
            setCrea(!crea);
            await setCreatine(!crea);
          })
        }
        aria-pressed={crea}
        className={`flex w-full items-center gap-3 rounded-xl p-4 text-left ${crea ? "bg-steel-2" : "bg-steel"}`}
      >
        <span
          className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${crea ? "border-go bg-go text-floor" : "border-line"}`}
        >
          {crea && <Check size={18} strokeWidth={3} />}
        </span>
        <span className="flex-1">
          <span className="block font-semibold">{crea ? "Creatine genomen" : `Creatine nemen (${String(creatineG).replace(".", ",")} g)`}</span>
          <span className="text-sm text-mute">
            {creatineStreak > 0 ? `${creatineStreak} ${creatineStreak === 1 ? "dag" : "dagen"} op rij` : "Nog geen streak"}
          </span>
        </span>
      </button>
    </div>
  );
}
