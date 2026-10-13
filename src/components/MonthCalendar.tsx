import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { dayKey, WEEKDAY_SHORT } from "@/lib/dates";
import { DAY_COLOR, monthGrid, monthLabel, shiftMonth, workoutsByDay } from "@/lib/history";
import { DAY_LABEL } from "@/lib/schedule";
import type { Workout } from "@/lib/types";

/**
 * Maandkalender met een gekleurd blokje per training. Tik op een dag met een
 * gymtraining om hem te openen.
 * @param hrefForMonth link naar een andere maand (behoudt de rest van de pagina-instellingen)
 */
export function MonthCalendar({
  workouts,
  month,
  hrefForMonth,
}: {
  workouts: Workout[];
  month: string;
  hrefForMonth: (m: string) => string;
}) {
  const today = dayKey();
  const byDay = workoutsByDay(workouts);
  const grid = monthGrid(month);
  const thisMonth = today.slice(0, 7);
  const count = [...byDay.entries()].filter(([k]) => k.slice(0, 7) === month).reduce((a, [, ws]) => a + ws.length, 0);
  const used = new Set(workouts.filter((w) => w.completed_at && dayKey(w.started_at).slice(0, 7) === month).map((w) => w.day_type));

  return (
    <section className="card p-3">
      <div className="mb-2 flex items-center gap-2">
        <Link href={hrefForMonth(shiftMonth(month, -1))} aria-label="Vorige maand" className="grid size-9 place-items-center rounded-full bg-floor">
          <ChevronLeft size={18} />
        </Link>
        <div className="flex-1 text-center">
          <p className="font-semibold">{monthLabel(month)}</p>
          <p className="text-xs text-mute">
            {count} {count === 1 ? "training" : "trainingen"}
          </p>
        </div>
        {month < thisMonth ? (
          <Link href={hrefForMonth(shiftMonth(month, 1))} aria-label="Volgende maand" className="grid size-9 place-items-center rounded-full bg-floor">
            <ChevronRight size={18} />
          </Link>
        ) : (
          <span className="size-9" />
        )}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} className="pb-1 text-[11px] text-mute">
            {d}
          </span>
        ))}
        {grid.map(({ key, inMonth }) => {
          const ws = byDay.get(key) ?? [];
          const gym = ws.find((w) => w.day_type !== "cardio");
          const isToday = key === today;
          const cell = (
            <div
              className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-sm ${
                inMonth ? "" : "opacity-30"
              } ${isToday ? "ring-2 ring-chalk/70" : ""} ${ws.length ? "bg-floor" : ""}`}
            >
              <span className={ws.length ? "font-semibold" : "text-mute"}>{Number(key.slice(8))}</span>
              <span className="flex h-1.5 gap-0.5">
                {ws.map((w) => (
                  <span key={w.id} className="h-1.5 w-3 rounded-full" style={{ background: DAY_COLOR[w.day_type] }} />
                ))}
              </span>
            </div>
          );
          return gym ? (
            <Link key={key} href={`/training/${gym.id}/klaar`} aria-label={`${DAY_LABEL[gym.day_type]} op ${key}`}>
              {cell}
            </Link>
          ) : (
            <div key={key}>{cell}</div>
          );
        })}
      </div>

      {used.size > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-mute">
          {(["push", "pull", "legs", "upper", "cardio"] as const)
            .filter((d) => used.has(d))
            .map((d) => (
              <span key={d} className="inline-flex items-center gap-1">
                <span className="h-1.5 w-3 rounded-full" style={{ background: DAY_COLOR[d] }} /> {DAY_LABEL[d]}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
