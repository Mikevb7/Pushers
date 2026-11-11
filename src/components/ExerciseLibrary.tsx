"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Plus, Search } from "lucide-react";
import { EXERCISES, EXERCISE_MAP, MUSCLE_LABEL, stationVariants, videoUrl, type Exercise, type LoadType, type Muscle } from "@/lib/exercises";

const KIND: { id: string; label: string; match: (e: Exercise) => boolean }[] = [
  { id: "machine", label: "Machine", match: (e) => e.load === "machine" },
  { id: "kabel", label: "Kabel", match: (e) => e.load === "kabel" },
  { id: "dumbbell", label: "Dumbbells", match: (e) => e.load === "dumbbell" },
  { id: "stang", label: "Stang / Smith", match: (e) => e.load === "stang" || e.load === "smith" },
  { id: "lichaamsgewicht", label: "Eigen gewicht", match: (e) => e.load === "lichaamsgewicht" },
];

const MUSCLE_ORDER: Muscle[] = ["borst", "rug", "schouders", "biceps", "triceps", "quads", "hamstrings", "billen", "kuiten", "adductoren", "buik", "onderrug"];

/** Witte-kabel- en Evolve-varianten tonen we als één oefening met een stationkeuze. */
const isStationCopy = (e: Exercise) => /-(wit|evolve)$/.test(e.id) && !!EXERCISE_MAP[e.id.replace(/-(wit|evolve)$/, "")];

const loadHint: Record<LoadType, string> = {
  machine: "Machine",
  kabel: "Kabel",
  dumbbell: "Dumbbells",
  stang: "Stang",
  smith: "Smith",
  lichaamsgewicht: "Eigen gewicht",
};

const stationLabel = (id: string) => {
  const eq = EXERCISE_MAP[id]?.equipment ?? "";
  if (id.endsWith("-wit") || eq.startsWith("Witte Life")) return "Witte kabels";
  if (id.endsWith("-evolve") || eq.startsWith("Evolve")) return "Evolve";
  return "Toevoegen";
};

/**
 * Oefeningenbibliotheek. Zonder onPick: rustig bladeren en uitleg lezen.
 * Met onPick: kiezen voor een bonusoefening in de training.
 */
export function ExerciseLibrary({ onPick, exclude = [], compact = false }: { onPick?: (id: string) => void; exclude?: string[]; compact?: boolean }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return EXERCISES.filter((e) => !isStationCopy(e))
      .filter((e) => !muscle || e.muscle === muscle || e.secondary?.includes(muscle))
      .filter((e) => !kind || KIND.find((k) => k.id === kind)!.match(e))
      .filter((e) => !needle || `${e.name} ${e.equipment} ${MUSCLE_LABEL[e.muscle]}`.toLowerCase().includes(needle));
  }, [q, muscle, kind]);

  const groups = MUSCLE_ORDER.map((m) => ({ m, items: list.filter((e) => e.muscle === m) })).filter((g) => g.items.length);
  const chip = (on: boolean) => `shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${on ? "bg-pin text-chalk" : "bg-steel-2"}`;

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-xl border border-line bg-steel px-3 py-2.5">
        <Search size={16} className="text-mute" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek oefening of apparaat" className="w-full bg-transparent outline-none" />
      </label>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Spiergroep">
        <button onClick={() => setMuscle(null)} className={chip(muscle === null)}>
          Alles
        </button>
        {MUSCLE_ORDER.filter((m) => EXERCISES.some((e) => e.muscle === m)).map((m) => (
          <button key={m} onClick={() => setMuscle(muscle === m ? null : m)} className={chip(muscle === m)}>
            {MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Soort">
        {KIND.map((k) => (
          <button key={k.id} onClick={() => setKind(kind === k.id ? null : k.id)} className={chip(kind === k.id)}>
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-mute">{list.length} oefeningen</p>

      {groups.map(({ m, items }) => (
        <section key={m} className="space-y-2">
          {!muscle && <h2 className="display pt-1 text-xl font-semibold uppercase">{MUSCLE_LABEL[m]}</h2>}
          {items.map((e) => {
            const open = openId === e.id;
            const stations = [e.id, ...stationVariants(e.id)].filter((id) => !exclude.includes(id));
            const taken = exclude.includes(e.id) && stations.length === 0;
            return (
              <article key={e.id} className="card overflow-hidden">
                <button onClick={() => setOpenId(open ? null : e.id)} className="flex w-full items-center gap-3 p-2.5 text-left" aria-expanded={open}>
                  <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-floor">
                    <Image src={e.photo} alt="" fill sizes="56px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold leading-tight">{e.name}</h3>
                    <p className="truncate text-xs text-mute">
                      {loadHint[e.load]}
                      {stationVariants(e.id).length ? " · Evolve of witte kabels" : ""}
                      {e.secondary?.length ? ` · ook ${e.secondary.map((s) => MUSCLE_LABEL[s].toLowerCase()).join(", ")}` : ""}
                    </p>
                  </div>
                  <ChevronDown size={18} className={`shrink-0 text-mute transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
                {open && (
                  <div className="space-y-2.5 px-3 pb-3 text-sm">
                    {!compact && (
                      <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-floor">
                        <Image src={e.photo} alt={e.equipment} fill sizes="(max-width: 448px) 100vw, 448px" className="object-cover" />
                      </div>
                    )}
                    <p>
                      <span className="text-mute">Apparaat: </span>
                      {e.equipment}
                    </p>
                    <p>
                      <span className="text-mute">Instellen: </span>
                      {e.setup}
                    </p>
                    <ul className="list-disc space-y-1 pl-5">
                      {e.tips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    <a href={videoUrl(e)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-pin-deep">
                      Bekijk uitlegvideo&apos;s <ExternalLink size={14} />
                    </a>
                    {onPick &&
                      (taken ? (
                        <p className="text-mute">Staat al in je training.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {stations.map((id) => (
                            <button
                              key={id}
                              onClick={() => onPick(id)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-pin px-3.5 py-2 font-semibold text-chalk"
                            >
                              <Plus size={15} />
                              {stations.length > 1 ? stationLabel(id) : "Toevoegen"}
                            </button>
                          ))}
                        </div>
                      ))}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ))}
      {list.length === 0 && <p className="py-6 text-center text-sm text-mute">Niks gevonden. Probeer een ander woord of filter.</p>}
    </div>
  );
}
