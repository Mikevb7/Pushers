"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, Check, ChevronDown, ExternalLink, Pencil, Plus, Repeat, Sparkles, Trash2, Zap } from "lucide-react";
import { EXERCISE_MAP, optionsFor, snapToStack, videoUrl, type Exercise } from "@/lib/exercises";
import { DAY_LABEL, type GymDay } from "@/lib/schedule";
import type { PlannedItem } from "@/lib/plan";
import type { Suggestion } from "@/lib/progression";
import type { SetRow } from "@/lib/types";
import { deleteSet, discardWorkout, finishWorkout, logSet, updateSet } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export interface ExerciseInfo {
  suggestion: Suggestion;
  last: string | null;
  lastSets: { weight: number; reps: number }[]; // per set van de vorige keer
}

interface Props {
  workoutId: string;
  day: GymDay;
  startedAt: string;
  items: PlannedItem[];
  notes: string[];
  info: Record<string, ExerciseInfo>;
  logged: SetRow[];
  preferred: Record<number, string>; // per oefening: de variant die je de vorige keer koos
  editMode: boolean; // afgeronde training achteraf aanpassen
}

const unitLabel = (ex: Exercise) =>
  ex.plates
    ? "plaatnummer"
    : ex.stack
    ? `${ex.unit ?? "kg"} op het blok`
    : ex.load === "lichaamsgewicht" ? "kg extra" : ex.exclBar ? "kg zonder stang" : ex.load === "dumbbell" ? "kg per dumbbell" : "kg";
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const parse = (s: string) => Number(s.replace(",", "."));
const RIR = [0, 1, 2, 3];
const unitOf = (ex: Exercise) => ex.unit ?? "kg";
/** Startwaarde voor het gewichtveld: bij een apparaat met vast blok altijd een echt gewicht. */
const initWeight = (ex: Exercise, w: number | null) => (w === null ? "" : fmt(ex.stack ? snapToStack(ex, w) : w));

/**
 * Gewicht invullen. Heeft het apparaat een vast blok, dan kies je met − / + of uit de lijst
 * precies wat er op het blok staat. Anders vrij typen.
 */
function WeightField({ ex, value, onChange, className }: { ex: Exercise; value: string; onChange: (v: string) => void; className: string }) {
  if (!ex.stack?.length) {
    return (
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
        className={className}
        aria-label={unitLabel(ex)}
      />
    );
  }
  const stack = ex.stack;
  const cur = value === "" ? null : snapToStack(ex, parse(value));
  const idx = cur === null ? -1 : stack.indexOf(cur);
  const step = (n: number) => onChange(fmt(stack[Math.min(stack.length - 1, Math.max(0, (idx < 0 ? 0 : idx) + n))]));
  return (
    <div className="flex items-stretch gap-1">
      <button type="button" aria-label="Lichter" disabled={idx <= 0} onClick={() => step(-1)} className="w-9 shrink-0 rounded-xl bg-steel text-2xl font-bold text-chalk disabled:opacity-30">
        −
      </button>
      <select
        value={idx >= 0 ? String(stack[idx]) : ""}
        onChange={(e) => onChange(fmt(Number(e.target.value)))}
        aria-label={unitLabel(ex)}
        className={`${className} min-w-0 appearance-none [text-align-last:center]`}
      >
        {idx < 0 && <option value="">kies</option>}
        {stack.map((v) => (
          <option key={v} value={String(v)}>
            {fmt(v)}
          </option>
        ))}
      </select>
      <button type="button" aria-label="Zwaarder" disabled={idx >= stack.length - 1} onClick={() => step(1)} className="w-9 shrink-0 rounded-xl bg-steel text-2xl font-bold text-chalk disabled:opacity-30">
        +
      </button>
    </div>
  );
}
const SUPERSET_COLOR: Record<string, string> = { A: "var(--color-pin)", B: "#4f8fd6", C: "#e08a2c" };

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const mins = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
  return <span>{mins} min</span>;
}

function RestTimer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    const t = setInterval(() => {
      const l = Math.max(0, Math.round((end - Date.now()) / 1000));
      setLeft(l);
      if (l === 0) {
        clearInterval(t);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(300);
      }
    }, 250);
    return () => clearInterval(t);
  }, [seconds]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center gap-3 border-t border-line bg-steel-2 px-4 py-3">
        <span className={`display text-4xl font-bold ${left === 0 ? "text-go" : ""}`}>
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
        </span>
        <span className="flex-1 text-sm text-mute">{left === 0 ? "Volgende set!" : "Rust"}</span>
        <button onClick={onDone} className="rounded-lg bg-floor px-4 py-2 font-semibold">
          {left === 0 ? "Sluiten" : "Overslaan"}
        </button>
      </div>
    </div>
  );
}

function SetForm({
  ex,
  setNumber,
  defaultWeight,
  defaultReps,
  onSave,
  label,
  hint,
  prev,
}: {
  label?: string;
  hint?: string;
  prev?: { weight: number; reps: number };
  ex: Exercise;
  setNumber: number;
  defaultWeight: number | null;
  defaultReps: number;
  onSave: (v: { weight: number; reps: number; rir: number | null; drop: { weight: number; reps: number } | null }) => Promise<void>;
}) {
  const [weight, setWeight] = useState(defaultWeight === null ? (ex.load === "lichaamsgewicht" ? "0" : "") : initWeight(ex, defaultWeight));
  const [reps, setReps] = useState(String(defaultReps));
  const [rir, setRir] = useState<number | null>(null);
  const [drop, setDrop] = useState(false);
  const [dropW, setDropW] = useState("");
  const [dropR, setDropR] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (defaultWeight !== null) setWeight(initWeight(ex, defaultWeight));
  }, [defaultWeight, ex]);

  const valid = weight !== "" && !Number.isNaN(parse(weight)) && Number(reps) > 0 && rir !== null;

  async function save() {
    if (!valid) return;
    setBusy(true);
    setErr(null);
    try {
      await onSave({
        weight: parse(weight),
        reps: Number(reps),
        rir,
        drop: drop && dropW && dropR ? { weight: parse(dropW), reps: Number(dropR) } : null,
      });
      setRir(null);
      setDrop(false);
      setDropW("");
      setDropR("");
    } catch {
      setErr("Opslaan mislukt. Check je verbinding en probeer opnieuw.");
    }
    setBusy(false);
  }

  const box = "w-full rounded-xl border border-line bg-steel px-2 py-2.5 text-center display text-3xl font-semibold focus:border-pin focus:outline-none";

  return (
    <div className="rounded-2xl border border-pin bg-pin-dim/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm text-mute">
          {label ?? `Set ${setNumber}`}
          {prev && (
            <span className="ml-2 rounded bg-steel px-1.5 py-0.5 text-xs text-chalk">
              vorige keer {ex.plates ? `plaat ${fmt(prev.weight)}` : `${fmt(prev.weight)} ${unitOf(ex)}`} × {prev.reps}
            </span>
          )}
        </p>
        {hint && (
          <span className="inline-flex items-center gap-1 rounded-full bg-pin-deep px-2.5 py-0.5 text-xs font-semibold text-white">
            <Zap size={12} aria-hidden /> {hint}
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <WeightField ex={ex} value={weight} onChange={setWeight} className={box} />
          <span className="mt-1 block text-center text-xs text-mute">{unitLabel(ex)}</span>
        </label>
        <span className="display pb-7 text-2xl text-mute">×</span>
        <label className="block">
          <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} className={box} aria-label="reps" />
          <span className="mt-1 block text-center text-xs text-mute">reps</span>
        </label>
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1.5 text-sm text-mute">Hoeveel reps had je nog over?</legend>
        <div className="grid grid-cols-4 gap-1.5">
          {RIR.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRir(r)}
              aria-pressed={rir === r}
              className={`rounded-md py-2.5 font-semibold ${rir === r ? "bg-pin-deep text-white" : "bg-steel text-chalk"}`}
            >
              {r === 3 ? "3+" : r}
            </button>
          ))}
        </div>
      </fieldset>

      {ex.isolation && (
        <div className="mt-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={drop} onChange={(e) => setDrop(e.target.checked)} className="size-4 accent-pin" />
            Dropset erachteraan gedaan
          </label>
          {drop && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input inputMode="decimal" placeholder="drop kg" value={dropW} onChange={(e) => setDropW(e.target.value.replace(/[^\d.,]/g, ""))} className="rounded-xl border border-line bg-steel px-3 py-2" />
              <input inputMode="numeric" placeholder="drop reps" value={dropR} onChange={(e) => setDropR(e.target.value.replace(/\D/g, ""))} className="rounded-xl border border-line bg-steel px-3 py-2" />
            </div>
          )}
        </div>
      )}

      {err && <p className="mt-2 text-sm text-warn">{err}</p>}
      <button
        onClick={save}
        disabled={!valid || busy}
        className="mt-3 w-full rounded-full bg-pin py-3 font-semibold text-chalk disabled:bg-line disabled:text-mute"
      >
        {busy ? "Opslaan…" : rir === null ? "Kies eerst hoeveel je over had" : "Set opslaan"}
      </button>
    </div>
  );
}

function LoggedSet({ s, ex, onDelete, onUpdate }: { s: SetRow; ex: Exercise; onDelete: (id: string) => void; onUpdate: (row: SetRow) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(initWeight(ex, Number(s.weight_kg)));
  const [reps, setReps] = useState(String(s.reps));
  const [rir, setRir] = useState<number | null>(s.rir);
  const [busy, setBusy] = useState(false);
  const pendingSave = s.id.startsWith("tmp-");

  if (editing) {
    const box = "w-full rounded-xl border border-line bg-steel px-2 py-2 text-center display text-2xl font-semibold focus:border-pin-deep focus:outline-none";
    return (
      <div className="space-y-2 rounded-2xl border border-pin bg-pin-dim/60 p-3">
        <p className="text-sm text-mute">Set {s.set_number} aanpassen</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <WeightField ex={ex} value={weight} onChange={setWeight} className={box} />
          <span className="text-mute">×</span>
          <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} className={box} aria-label="reps" />
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {RIR.map((r) => (
            <button key={r} type="button" onClick={() => setRir(r)} aria-pressed={rir === r} className={`rounded-md py-2 text-sm font-semibold ${rir === r ? "bg-pin-deep text-white" : "bg-steel text-chalk"}`}>
              {r === 3 ? "3+" : r} over
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || !weight || !Number(reps)}
            onClick={async () => {
              setBusy(true);
              const ok = await onUpdate({ ...s, weight_kg: parse(weight), reps: Number(reps), rir });
              setBusy(false);
              if (ok) setEditing(false);
            }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-pin py-2.5 font-semibold text-chalk disabled:opacity-60"
          >
            <Check size={16} /> {busy ? "Opslaan…" : "Opslaan"}
          </button>
          <button onClick={() => setEditing(false)} className="rounded-full bg-steel px-4 font-semibold text-mute">
            Annuleer
          </button>
          <button onClick={() => onDelete(s.id)} aria-label={`Set ${s.set_number} verwijderen`} className="rounded-full bg-steel px-3 text-warn">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={pendingSave}
      onClick={() => setEditing(true)}
      className="flex w-full items-center gap-3 rounded-lg bg-floor px-3 py-2 text-left"
      aria-label={`Set ${s.set_number} aanpassen`}
    >
      <span className="w-10 text-sm text-mute">Set {s.set_number}</span>
      <span className="display flex-1 text-2xl font-semibold">
        {ex.plates ? <span className="text-base text-mute">plaat </span> : null}
        {fmt(Number(s.weight_kg))} {ex.plates ? null : <span className="text-base text-mute">{unitOf(ex)}</span>} × {s.reps}
      </span>
      <span className="text-xs text-mute">
        {pendingSave ? "opslaan…" : s.rir === null ? "" : s.rir === 3 ? "3+ over" : `${s.rir} over`}
        {s.is_drop ? ", + drop" : ""}
      </span>
      <Pencil size={14} className="text-mute" aria-hidden />
    </button>
  );
}

function ExerciseBlock({
  item,
  exerciseId,
  info,
  sets,
  onSwap,
  taken,
  onLog,
  onDelete,
  onUpdate,
  active,
  onActivate,
  inGroup = false,
  formLabel,
  formHint,
  scrollSignal = 0,
  extra = 0,
  onExtra,
}: {
  extra?: number;
  onExtra: () => void;
  inGroup?: boolean;
  formLabel?: string;
  formHint?: string;
  scrollSignal?: number;
  onUpdate: (row: SetRow) => Promise<boolean>;
  active: boolean;
  onActivate: () => void;
  item: PlannedItem;
  exerciseId: string;
  info: ExerciseInfo | undefined;
  sets: SetRow[];
  onSwap: (to: string) => void;
  /** Oefeningen die al op een andere plek in deze training staan: niet als alternatief tonen. */
  taken: string[];
  onLog: (exerciseId: string, setNumber: number, v: Parameters<React.ComponentProps<typeof SetForm>["onSave"]>[0]) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const ex = EXERCISE_MAP[exerciseId];
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const target = Math.max(item.sets + extra, sets.length);
  const done = sets.length >= item.sets;
  const sug = info?.suggestion;
  const lastWeight = sets.length ? Number(sets[sets.length - 1].weight_kg) : (sug?.weight ?? null);
  const ref = useRef<HTMLElement>(null);

  // Na het loggen van een set: scroll naar de oefening die nu aan de beurt is.
  useEffect(() => {
    if (scrollSignal > 0 && active) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollSignal]);

  return (
    <section ref={ref} className={`scroll-mt-20 ${inGroup ? "border-t border-line first:border-t-0" : "card"} ${done ? "opacity-80" : ""}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full gap-3 p-3 text-left" aria-expanded={open}>
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-floor">
          <Image src={ex.photo} alt="" fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.coach && <Sparkles size={14} className="text-pin-deep" aria-label="Aangepast door coach" />}
          </div>
          <h3 className="font-semibold leading-tight">{ex.name}</h3>
          <p className="text-sm text-mute">
            {item.sets} × {item.repMin}-{item.repMax}
            {info?.last ? `, vorige keer ${info.last}` : ""}
          </p>
        </div>
        <span className="flex flex-col items-end justify-between">
          <span className={`display text-xl font-bold ${done ? "text-go" : "text-mute"}`}>
            {sets.length}/{item.sets}
          </span>
          <ChevronDown size={18} className={`text-mute transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>

      {open && (
        <div className="space-y-3 px-3 pb-3">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-floor">
            <Image src={ex.photo} alt={ex.equipment} fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" />
          </div>
          <p className="text-sm">
            <span className="text-mute">Apparaat: </span>
            {ex.equipment}
          </p>
          <p className="text-sm">
            <span className="text-mute">Instellen: </span>
            {ex.setup}
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {ex.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <a href={videoUrl(ex)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm text-pin-deep">
            Bekijk uitlegvideo&apos;s <ExternalLink size={14} />
          </a>
          {item.coach && <p className="rounded-lg bg-floor px-3 py-2 text-sm">Coach: {item.coach}</p>}
        </div>
      )}

      <div className="space-y-2 px-3 pb-3">
        {sets.length === 0 && optionsFor(item.exerciseId).filter((a) => !taken.includes(a)).length > 1 && (
          <div>
            <button type="button" onClick={() => setPicking((p) => !p)} className="flex items-center gap-1.5 text-sm font-medium text-pin-deep" aria-expanded={picking}>
              <Repeat size={14} /> Ander apparaat of oefening
            </button>
            {picking && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {optionsFor(item.exerciseId)
                  .filter((a) => a !== exerciseId && !taken.includes(a))
                  .map((a) => (
                    <button
                      key={a}
                      onClick={() => {
                        onSwap(a);
                        setPicking(false);
                      }}
                      className="rounded-full bg-steel-2 px-3 py-1.5 text-sm"
                    >
                      {EXERCISE_MAP[a].name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
        {sug && sets.length === 0 && (
          <p className={`rounded-lg px-3 py-2 text-sm ${sug.kind === "increase" ? "bg-go/15 text-go" : sug.kind === "stall" ? "bg-warn/10 text-warn" : "bg-floor text-chalk"}`}>
            {sug.text}
          </p>
        )}
        {sets.map((row) => (
          <LoggedSet key={row.id} s={row} ex={ex} onDelete={onDelete} onUpdate={onUpdate} />
        ))}
        {sets.length < target && !active && (
          <button onClick={onActivate} className="w-full rounded-lg bg-steel-2 py-2.5 text-sm font-semibold">
            {sets.length ? "Verder met deze oefening" : "Deze oefening loggen"}
          </button>
        )}
        {sets.length < target && active && (
          <SetForm
            key={`${exerciseId}-${sets.length}`}
            ex={ex}
            setNumber={sets.length + 1}
            label={formLabel}
            hint={formHint}
            prev={info?.lastSets?.[sets.length]}
            defaultWeight={lastWeight}
            defaultReps={sets.length ? sets[sets.length - 1].reps : (sug?.reps ?? item.repMax)}
            onSave={(v) => onLog(exerciseId, sets.length + 1, v)}
          />
        )}
        {sets.length >= target && (
          <button onClick={onExtra} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-sm text-mute">
            <Plus size={14} /> Extra set
          </button>
        )}
      </div>
    </section>
  );
}

export function TrainingSession({ workoutId, day, startedAt, items, notes, info, logged, preferred, editMode }: Props) {
  const [sets, setSets] = useState<SetRow[]>(logged);
  const [swaps, setSwaps] = useState<Record<number, string>>(() => {
    // Als er al sets van een alternatief zijn gelogd, toon dat alternatief.
    // Een oefening die zelf ook in het schema staat telt nooit als alternatief voor een andere plek,
    // anders verschijnen dezelfde sets in twee blokken (en tellen ze dubbel mee).
    const out: Record<number, string> = {};
    const planned = new Set(items.map((it) => it.exerciseId));
    items.forEach((it, i) => {
      const alt = optionsFor(it.exerciseId)
        .filter((a) => a === it.exerciseId || !planned.has(a))
        .find((a) => logged.some((s) => s.exercise_id === a));
      if (alt && alt !== it.exerciseId) out[i] = alt;
      else if (!alt && preferred[i]) out[i] = preferred[i];
    });
    return out;
  });
  const [rest, setRest] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [split, setSplit] = useState<Record<string, boolean>>({}); // superset toch los doen
  const [goNext, setGoNext] = useState<string | null>(null); // "direct door"-melding
  const [scrollSignal, setScrollSignal] = useState(0);
  const [extras, setExtras] = useState<Record<number, number>>({}); // extra sets per oefening
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const totalPlanned = items.reduce((a, b) => a + b.sets, 0);
  const totalDone = useMemo(
    () => items.reduce((a, it, i) => a + Math.min(it.sets, sets.filter((s) => s.exercise_id === (swaps[i] ?? it.exerciseId)).length), 0),
    [items, sets, swaps],
  );

  const exOf = (i: number) => swaps[i] ?? items[i].exerciseId;
  const countIn = (list: SetRow[], i: number) => list.filter((s) => s.exercise_id === exOf(i)).length;

  // Opeenvolgende oefeningen met dezelfde superset-letter vormen samen één blok.
  const segments = useMemo(() => {
    const out: { letter: string | null; idx: number[] }[] = [];
    items.forEach((it, i) => {
      const prev = out[out.length - 1];
      if (it.superset && prev?.letter === it.superset) prev.idx.push(i);
      else out.push({ letter: it.superset ?? null, idx: [i] });
    });
    return out.map((g) => (g.idx.length > 1 ? g : { letter: null, idx: g.idx }));
  }, [items]);
  const groupOf = (i: number) => segments.find((g) => g.letter && !split[g.letter] && g.idx.includes(i)) ?? null;

  /** In een superset: de oefening met de minste sets is aan de beurt (bij gelijk: de eerste). */
  function nextInGroup(idx: number[], list: SetRow[]): number | null {
    const open = idx.filter((i) => countIn(list, i) < items[i].sets);
    if (!open.length) return null;
    return open.reduce((best, i) => (countIn(list, i) < countIn(list, best) ? i : best), open[0]);
  }

  const firstOpenRaw = items.findIndex((it, i) => countIn(sets, i) < it.sets);
  const firstGroup = firstOpenRaw >= 0 ? groupOf(firstOpenRaw) : null;
  const firstOpen = firstGroup ? (nextInGroup(firstGroup.idx, sets) ?? firstOpenRaw) : firstOpenRaw;
  // Een oefening is "open" zolang de geplande sets plus eventuele extra sets nog niet gelogd zijn.
  const chosenOpen = chosen !== null && countIn(sets, chosen) < items[chosen].sets + (extras[chosen] ?? 0);
  const activeIndex = chosen !== null && chosenOpen ? chosen : firstOpen;

  const [saveError, setSaveError] = useState<string | null>(null);
  const pct = totalPlanned ? Math.round((totalDone / totalPlanned) * 100) : 0;

  // Optimistisch: de set staat direct in beeld, het opslaan gebeurt op de achtergrond.
  async function onLog(
    exerciseId: string,
    setNumber: number,
    v: { weight: number; reps: number; rir: number | null; drop: { weight: number; reps: number } | null },
    index: number,
  ) {
    const tempId = `tmp-${Date.now()}`;
    const temp: SetRow = {
      id: tempId,
      workout_id: workoutId,
      user_id: "",
      exercise_id: exerciseId,
      set_number: setNumber,
      weight_kg: v.weight,
      reps: v.reps,
      rir: v.rir,
      is_drop: !!v.drop,
      drop_weight_kg: v.drop?.weight ?? null,
      drop_reps: v.drop?.reps ?? null,
      created_at: new Date().toISOString(),
    };
    setSaveError(null);
    setSets((prev) => [...prev, temp]);

    const after = [...sets, temp];
    const group = groupOf(index);
    if (group) {
      // Superset: pas rust na de laatste oefening van de ronde, anders direct door.
      const c = countIn(after, index);
      const roundDone = group.idx.every((i) => countIn(after, i) >= Math.min(c, items[i].sets));
      const next = nextInGroup(group.idx, after);
      setChosen(next);
      setScrollSignal((n) => n + 1);
      if (!roundDone && next !== null) {
        setRest(null);
        setGoNext(EXERCISE_MAP[exOf(next)].name);
      } else {
        setGoNext(null);
        if (!editMode) setRest(group.idx.every((i) => EXERCISE_MAP[exOf(i)].isolation) ? 90 : 120);
      }
    } else {
      setGoNext(null);
      if (countIn(after, index) >= items[index].sets) setScrollSignal((n) => n + 1);
      if (!editMode) setRest(EXERCISE_MAP[exerciseId].isolation ? 90 : 150);
    }
    try {
      const row = await logSet({ workoutId, exerciseId, setNumber, ...v });
      setSets((prev) => prev.map((s) => (s.id === tempId ? (row as SetRow) : s)));
    } catch {
      setSets((prev) => prev.filter((s) => s.id !== tempId));
      setSaveError("Set niet opgeslagen. Check je verbinding en vul hem opnieuw in.");
    }
  }

  async function onUpdate(row: SetRow): Promise<boolean> {
    try {
      const saved = await updateSet({ id: row.id, weight: Number(row.weight_kg), reps: row.reps, rir: row.rir });
      setSets((prev) => prev.map((x) => (x.id === row.id ? (saved as SetRow) : x)));
      setSaveError(null);
      return true;
    } catch {
      setSaveError("Aanpassen mislukt. Check je verbinding en probeer opnieuw.");
      return false;
    }
  }

  function onDelete(id: string) {
    setSets((prev) => prev.filter((s) => s.id !== id));
    if (!id.startsWith("tmp-")) start(() => deleteSet(id));
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-steel/95 px-4 pb-2.5 pt-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Terug" className="p-1 text-mute">
            <ArrowLeft size={22} />
          </Link>
          <div className="flex-1">
            <p className="display text-3xl font-bold uppercase">{DAY_LABEL[day]}</p>
            {editMode && <p className="text-xs text-mute">Training aanpassen: tik op een set om hem te wijzigen</p>}
          </div>
          <div className="text-right text-sm text-mute">
            <p>
              {totalDone}/{totalPlanned} sets
            </p>
            {!editMode && <Elapsed since={startedAt} />}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label="Voortgang training"
          >
            <div className="h-full rounded-full bg-pin transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className={`display w-12 text-right text-xl font-bold ${pct === 100 ? "text-go" : ""}`}>{pct}%</span>
        </div>
      </header>

      {saveError && <p className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm">{saveError}</p>}

      {notes.length > 0 && (
        <div className="rounded-xl border border-pin/40 bg-pin-dim/30 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <Sparkles size={15} className="text-pin-deep" /> Coach
          </p>
          {notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      {segments.map((g) => {
        const block = (i: number, inGroup: boolean, formLabel?: string, formHint?: string) => {
          const it = items[i];
          const exId = exOf(i);
          return (
            <ExerciseBlock
              key={`${i}-${exId}`}
              item={it}
              exerciseId={exId}
              info={info[exId]}
              sets={sets.filter((s) => s.exercise_id === exId).sort((a, b) => a.set_number - b.set_number)}
              onSwap={(to) => setSwaps((s) => ({ ...s, [i]: to }))}
              taken={items.map((_, j) => exOf(j)).filter((_, j) => j !== i)}
              onLog={(id, n, v) => onLog(id, n, v, i)}
              onDelete={onDelete}
              onUpdate={onUpdate}
              active={i === activeIndex}
              onActivate={() => setChosen(i)}
              inGroup={inGroup}
              formLabel={formLabel}
              formHint={formHint}
              scrollSignal={scrollSignal}
              extra={extras[i] ?? 0}
              onExtra={() => {
                setExtras((x) => ({ ...x, [i]: (x[i] ?? 0) + 1 }));
                setChosen(i);
              }}
            />
          );
        };
        if (!g.letter) return block(g.idx[0], false);

        const letter = g.letter;
        const color = SUPERSET_COLOR[letter] ?? SUPERSET_COLOR.A;
        if (split[letter]) {
          return (
            <div key={letter} className="space-y-4">
              <button
                onClick={() => setSplit((s) => ({ ...s, [letter]: false }))}
                className="flex items-center gap-1.5 text-sm font-medium text-pin-deep"
              >
                <Zap size={14} /> Superset {letter} los aan het doen. Weer als superset
              </button>
              {g.idx.map((i) => block(i, false))}
            </div>
          );
        }

        const rounds = Math.max(...g.idx.map((i) => items[i].sets));
        const counts = g.idx.map((i) => countIn(sets, i));
        const round = Math.min(rounds, Math.min(...g.idx.map((i, k) => (counts[k] >= items[i].sets ? Infinity : counts[k]))) + 1);
        const allDone = g.idx.every((i, k) => counts[k] >= items[i].sets);
        return (
          <section key={letter} className="card relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} aria-hidden />
            <header className="flex items-center gap-2 border-b border-line py-2.5 pl-5 pr-3">
              <Zap size={16} style={{ color }} aria-hidden />
              <div className="flex-1">
                <p className="display text-lg font-semibold uppercase leading-none">Superset {letter}</p>
                <p className="mt-0.5 text-xs text-mute">
                  {allDone ? `${rounds} rondes gedaan` : `Ronde ${round} van ${rounds}, direct na elkaar, rust na de ronde`}
                </p>
              </div>
              {!allDone && !editMode && (
                <button
                  onClick={() => {
                    setSplit((s) => ({ ...s, [letter]: true }));
                    setGoNext(null);
                  }}
                  className="rounded-full bg-steel-2 px-3 py-1.5 text-xs font-semibold"
                >
                  Toch los doen
                </button>
              )}
            </header>
            <div className="pl-1.5">
              {g.idx.map((i, k) => {
                const ahead = g.idx.some((j) => countIn(sets, j) > counts[k]);
                return block(
                  i,
                  true,
                  `${letter}${k + 1} · ronde ${counts[k] + 1}`,
                  ahead && !editMode ? "Direct door, geen rust" : undefined,
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="space-y-3 pt-2">
        {!editMode && (
        <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notitie (optioneel), bijv. slecht geslapen of schouder voelde raar"
            rows={2}
            className="w-full rounded-lg border border-line bg-steel px-3 py-2.5"
          />
        )}
        {editMode ? (
          <Link
            href={`/training/${workoutId}/klaar`}
            className="block w-full rounded-full bg-pin py-4 text-center text-xl font-semibold text-chalk"
          >
            Klaar met aanpassen
          </Link>
        ) : (
        <form action={finishWorkout.bind(null, workoutId, note)}>
          <SubmitButton
            disabled={pending || sets.length === 0 || sets.some((s) => s.id.startsWith("tmp-"))}
            pendingText="Afronden…"
            className="w-full rounded-full bg-pin py-4 text-xl font-semibold text-chalk disabled:bg-line disabled:text-mute"
          >
            Training afronden
          </SubmitButton>
        </form>
        )}
        <form
          action={discardWorkout.bind(null, workoutId)}
          onSubmit={(e) => {
            if (sets.length > 0 && !window.confirm(editMode ? "Hele training verwijderen? Alle sets gaan verloren." : "Training weggooien? Je gelogde sets gaan verloren.")) e.preventDefault();
          }}
        >
          <button className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-mute">
            <Trash2 size={14} /> {editMode ? "Hele training verwijderen" : "Training weggooien"}
          </button>
        </form>
      </section>

      {rest !== null && <RestTimer key={sets.length} seconds={rest} onDone={() => setRest(null)} />}
      {goNext && rest === null && (
        <div className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-md items-center gap-3 border-t border-pin-deep bg-pin-deep px-4 py-3 text-white">
            <Zap size={22} aria-hidden />
            <div className="flex-1">
              <p className="display text-2xl font-bold uppercase leading-none">Direct door</p>
              <p className="text-sm text-white/85">{goNext}, geen rust</p>
            </div>
            <button onClick={() => setGoNext(null)} className="rounded-lg bg-white/15 px-4 py-2 font-semibold">
              Oké
            </button>
          </div>
        </div>
      )}
      {(rest !== null || goNext) && <div className="h-16" />}
    </div>
  );
}
