"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeft, ChevronDown, ExternalLink, Plus, Repeat, Sparkles, Trash2, X } from "lucide-react";
import { EXERCISE_MAP, videoUrl, type Exercise } from "@/lib/exercises";
import { DAY_LABEL, type GymDay } from "@/lib/schedule";
import type { PlannedItem } from "@/lib/plan";
import type { Suggestion } from "@/lib/progression";
import type { SetRow } from "@/lib/types";
import { deleteSet, discardWorkout, finishWorkout, logSet } from "@/app/actions";
import { SubmitButton } from "@/components/SubmitButton";

export interface ExerciseInfo {
  suggestion: Suggestion;
  last: string | null;
}

interface Props {
  workoutId: string;
  day: GymDay;
  startedAt: string;
  items: PlannedItem[];
  notes: string[];
  info: Record<string, ExerciseInfo>;
  logged: SetRow[];
}

const unitLabel = (ex: Exercise) =>
  ex.plates
    ? "plaatnummer"
    : ex.load === "lichaamsgewicht" ? "kg extra" : ex.exclBar ? "kg zonder stang" : ex.load === "dumbbell" ? "kg per dumbbell" : "kg";
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
const parse = (s: string) => Number(s.replace(",", "."));
const RIR = [0, 1, 2, 3];

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
}: {
  ex: Exercise;
  setNumber: number;
  defaultWeight: number | null;
  defaultReps: number;
  onSave: (v: { weight: number; reps: number; rir: number | null; drop: { weight: number; reps: number } | null }) => Promise<void>;
}) {
  const [weight, setWeight] = useState(defaultWeight === null ? (ex.load === "lichaamsgewicht" ? "0" : "") : fmt(defaultWeight));
  const [reps, setReps] = useState(String(defaultReps));
  const [rir, setRir] = useState<number | null>(null);
  const [drop, setDrop] = useState(false);
  const [dropW, setDropW] = useState("");
  const [dropR, setDropR] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (defaultWeight !== null) setWeight(fmt(defaultWeight));
  }, [defaultWeight]);

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
      <p className="mb-2 text-sm text-mute">Set {setNumber}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="block">
          <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value.replace(/[^\d.,]/g, ""))} className={box} aria-label={unitLabel(ex)} />
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

function ExerciseBlock({
  item,
  exerciseId,
  info,
  sets,
  onSwap,
  onLog,
  onDelete,
  active,
  onActivate,
}: {
  active: boolean;
  onActivate: () => void;
  item: PlannedItem;
  exerciseId: string;
  info: ExerciseInfo | undefined;
  sets: SetRow[];
  onSwap: (to: string) => void;
  onLog: (exerciseId: string, setNumber: number, v: Parameters<React.ComponentProps<typeof SetForm>["onSave"]>[0]) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const ex = EXERCISE_MAP[exerciseId];
  const [open, setOpen] = useState(false);
  const [extra, setExtra] = useState(0);
  const target = Math.max(item.sets + extra, sets.length);
  const done = sets.length >= item.sets;
  const sug = info?.suggestion;
  const lastWeight = sets.length ? Number(sets[sets.length - 1].weight_kg) : (sug?.weight ?? null);

  return (
    <section className={`card ${done ? "opacity-80" : ""}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full gap-3 p-3 text-left" aria-expanded={open}>
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-floor">
          <Image src={ex.photo} alt="" fill sizes="64px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.superset && <span className="rounded bg-pin-dim px-1.5 text-xs font-semibold text-pin-deep">Superset {item.superset}</span>}
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
          {ex.alternatives.length > 0 && sets.length === 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm text-mute">
                <Repeat size={14} /> Apparaat bezet? Wissel naar:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[item.exerciseId, ...EXERCISE_MAP[item.exerciseId].alternatives]
                  .filter((a) => a !== exerciseId)
                  .map((a) => (
                    <button key={a} onClick={() => onSwap(a)} className="rounded-full bg-steel-2 px-3 py-1.5 text-sm">
                      {EXERCISE_MAP[a].name}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2 px-3 pb-3">
        {sug && sets.length === 0 && (
          <p className={`rounded-lg px-3 py-2 text-sm ${sug.kind === "increase" ? "bg-go/15 text-go" : sug.kind === "stall" ? "bg-warn/10 text-warn" : "bg-floor text-chalk"}`}>
            {sug.text}
          </p>
        )}
        {sets.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-lg bg-floor px-3 py-2">
            <span className="w-10 text-sm text-mute">Set {s.set_number}</span>
            <span className="display flex-1 text-2xl font-semibold">
              {ex.plates ? <span className="text-base text-mute">plaat </span> : null}
              {fmt(Number(s.weight_kg))} {ex.plates ? null : <span className="text-base text-mute">kg</span>} × {s.reps}
            </span>
            <span className="text-xs text-mute">
              {s.rir === null ? "" : s.rir === 3 ? "3+ over" : `${s.rir} over`}
              {s.is_drop ? ", + drop" : ""}
            </span>
            <button onClick={() => onDelete(s.id)} aria-label={`Set ${s.set_number} verwijderen`} className="p-1 text-mute">
              <X size={16} />
            </button>
          </div>
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
            defaultWeight={lastWeight}
            defaultReps={sets.length ? sets[sets.length - 1].reps : (sug?.reps ?? item.repMax)}
            onSave={(v) => onLog(exerciseId, sets.length + 1, v)}
          />
        )}
        {sets.length >= target && (
          <button onClick={() => setExtra((e) => e + 1)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line py-2 text-sm text-mute">
            <Plus size={14} /> Extra set
          </button>
        )}
      </div>
    </section>
  );
}

export function TrainingSession({ workoutId, day, startedAt, items, notes, info, logged }: Props) {
  const [sets, setSets] = useState<SetRow[]>(logged);
  const [swaps, setSwaps] = useState<Record<number, string>>(() => {
    // Als er al sets van een alternatief zijn gelogd, toon dat alternatief.
    const out: Record<number, string> = {};
    items.forEach((it, i) => {
      const alt = [it.exerciseId, ...EXERCISE_MAP[it.exerciseId].alternatives].find((a) => logged.some((s) => s.exercise_id === a));
      if (alt && alt !== it.exerciseId) out[i] = alt;
    });
    return out;
  });
  const [rest, setRest] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  const totalPlanned = items.reduce((a, b) => a + b.sets, 0);
  const totalDone = useMemo(
    () => items.reduce((a, it, i) => a + Math.min(it.sets, sets.filter((s) => s.exercise_id === (swaps[i] ?? it.exerciseId)).length), 0),
    [items, sets, swaps],
  );

  const firstOpen = items.findIndex((it, i) => sets.filter((s) => s.exercise_id === (swaps[i] ?? it.exerciseId)).length < it.sets);
  const chosenOpen =
    chosen !== null && sets.filter((s) => s.exercise_id === (swaps[chosen] ?? items[chosen].exerciseId)).length < items[chosen].sets;
  const activeIndex = chosen !== null && chosenOpen ? chosen : firstOpen;

  const [saveError, setSaveError] = useState<string | null>(null);

  // Optimistisch: de set staat direct in beeld, het opslaan gebeurt op de achtergrond.
  async function onLog(exerciseId: string, setNumber: number, v: { weight: number; reps: number; rir: number | null; drop: { weight: number; reps: number } | null }) {
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
    setRest(EXERCISE_MAP[exerciseId].isolation ? 90 : 150);
    try {
      const row = await logSet({ workoutId, exerciseId, setNumber, ...v });
      setSets((prev) => prev.map((s) => (s.id === tempId ? (row as SetRow) : s)));
    } catch {
      setSets((prev) => prev.filter((s) => s.id !== tempId));
      setSaveError("Set niet opgeslagen. Check je verbinding en vul hem opnieuw in.");
    }
  }

  function onDelete(id: string) {
    setSets((prev) => prev.filter((s) => s.id !== id));
    if (!id.startsWith("tmp-")) start(() => deleteSet(id));
  }

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-20 -mx-4 flex items-center gap-3 border-b border-line bg-steel/95 px-4 py-3 backdrop-blur">
        <Link href="/" aria-label="Terug" className="p-1 text-mute">
          <ArrowLeft size={22} />
        </Link>
        <div className="flex-1">
          <p className="display text-3xl font-bold uppercase">{DAY_LABEL[day]}</p>
        </div>
        <div className="text-right text-sm text-mute">
          <p>
            {totalDone}/{totalPlanned} sets
          </p>
          <Elapsed since={startedAt} />
        </div>
      </header>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full bg-pin transition-[width]" style={{ width: `${(totalDone / totalPlanned) * 100}%` }} />
      </div>

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

      {items.map((it, i) => {
        const exId = swaps[i] ?? it.exerciseId;
        return (
          <ExerciseBlock
            key={`${i}-${exId}`}
            item={it}
            exerciseId={exId}
            info={info[exId]}
            sets={sets.filter((s) => s.exercise_id === exId).sort((a, b) => a.set_number - b.set_number)}
            onSwap={(to) => setSwaps((s) => ({ ...s, [i]: to }))}
            onLog={onLog}
            onDelete={onDelete}
            active={i === activeIndex}
            onActivate={() => setChosen(i)}
          />
        );
      })}

      <section className="space-y-3 pt-2">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notitie (optioneel), bijv. slecht geslapen of schouder voelde raar"
          rows={2}
          className="w-full rounded-lg border border-line bg-steel px-3 py-2.5"
        />
        <form action={finishWorkout.bind(null, workoutId, note)}>
          <SubmitButton
            disabled={pending || sets.length === 0 || sets.some((s) => s.id.startsWith("tmp-"))}
            pendingText="Afronden…"
            className="w-full rounded-full bg-pin py-4 text-xl font-semibold text-chalk disabled:bg-line disabled:text-mute"
          >
            Training afronden
          </SubmitButton>
        </form>
        <form
          action={discardWorkout.bind(null, workoutId)}
          onSubmit={(e) => {
            if (sets.length > 0 && !window.confirm("Training weggooien? Je gelogde sets gaan verloren.")) e.preventDefault();
          }}
        >
          <button className="flex w-full items-center justify-center gap-1.5 py-2 text-sm text-mute">
            <Trash2 size={14} /> Training weggooien
          </button>
        </form>
      </section>

      {rest !== null && <RestTimer key={sets.length} seconds={rest} onDone={() => setRest(null)} />}
      {rest !== null && <div className="h-16" />}
    </div>
  );
}
