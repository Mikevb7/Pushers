"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, X } from "lucide-react";

export interface CalendarDay {
  key: string;
  inMonth: boolean;
  isToday: boolean;
  workouts: { id: string; color: string; label: string; time: string; cardio: boolean }[];
}

const dayLabel = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  const s = new Intl.DateTimeFormat("nl-NL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(Date.UTC(y, m - 1, d)));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Kalenderdagen. Eén gymtraining: direct openen. Meerdere: eerst kiezen welke. */
export function CalendarGrid({ days }: { days: CalendarDay[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const chosen = days.find((d) => d.key === open);

  return (
    <>
      {days.map((d) => {
        const gym = d.workouts.filter((w) => !w.cardio);
        const cell = (
          <div
            className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-sm ${d.inMonth ? "" : "opacity-30"} ${
              d.isToday ? "ring-2 ring-chalk/70" : ""
            } ${d.workouts.length ? "bg-floor" : ""} ${open === d.key ? "!bg-pin-dim ring-2 ring-pin" : ""}`}
          >
            <span className={d.workouts.length ? "font-semibold" : "text-mute"}>{Number(d.key.slice(8))}</span>
            <span className="flex h-1.5 gap-0.5">
              {d.workouts.map((w) => (
                <span key={w.id} className="h-1.5 w-3 rounded-full" style={{ background: w.color }} />
              ))}
            </span>
          </div>
        );
        if (d.workouts.length > 1) {
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => setOpen(open === d.key ? null : d.key)}
              aria-expanded={open === d.key}
              aria-label={`${d.workouts.length} trainingen op ${d.key}, kies er een`}
            >
              {cell}
            </button>
          );
        }
        if (gym.length === 1) {
          return (
            <Link key={d.key} href={`/training/${gym[0].id}/klaar`} aria-label={`${gym[0].label} op ${d.key}`}>
              {cell}
            </Link>
          );
        }
        return <div key={d.key}>{cell}</div>;
      })}

      {chosen && (
        <div className="col-span-7 mt-1 rounded-xl border border-line bg-floor p-2 text-left">
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="text-sm font-semibold">{dayLabel(chosen.key)}</p>
            <button type="button" onClick={() => setOpen(null)} aria-label="Sluiten" className="p-1 text-mute">
              <X size={16} />
            </button>
          </div>
          <ul className="space-y-1">
            {chosen.workouts.map((w) => {
              const row = (
                <>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: w.color }} />
                  <span className="flex-1 font-semibold">{w.label}</span>
                  <span className="text-xs text-mute">{w.time}</span>
                  {!w.cardio && <ChevronRight size={16} className="text-mute" />}
                </>
              );
              return (
                <li key={w.id}>
                  {w.cardio ? (
                    <div className="flex items-center gap-2 rounded-lg bg-steel px-3 py-2.5 text-sm">{row}</div>
                  ) : (
                    <Link href={`/training/${w.id}/klaar`} className="flex items-center gap-2 rounded-lg bg-steel px-3 py-2.5 text-sm">
                      {row}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}
