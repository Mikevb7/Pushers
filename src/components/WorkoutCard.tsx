import Link from "next/link";
import { ChevronRight, Clock, HeartPulse, MessageCircle, Trophy } from "lucide-react";
import { EXERCISE_MAP, formatLoad } from "@/lib/exercises";
import { dayKey, formatDay, timeAgo } from "@/lib/dates";
import { DAY_COLOR, type WorkoutSummary } from "@/lib/history";
import { DAY_LABEL } from "@/lib/schedule";
import type { ReactionState } from "@/lib/social";
import type { PR } from "@/lib/stats";
import type { Workout } from "@/lib/types";
import { themeFor } from "@/lib/themes";
import { CrewName } from "./CrewName";
import { Reactions } from "./Reactions";

export const fmtKg = (n: number) => (n >= 1000 ? `${String(Math.round(n / 100) / 10).replace(".", ",")} t` : `${Math.round(n)} kg`);

export function DayTag({ day }: { day: Workout["day_type"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-semibold">
      <span className="size-2.5 rounded-full" style={{ background: DAY_COLOR[day] }} aria-hidden />
      {DAY_LABEL[day]}
    </span>
  );
}

export function DeltaBadge({ pct }: { pct: number | null }) {
  if (pct === null || Math.abs(pct) < 0.5) return null;
  const up = pct > 0;
  return (
    <span className={`rounded px-1.5 text-xs font-semibold ${up ? "bg-go/15 text-go" : "bg-warn/10 text-warn"}`}>
      {up ? "↑" : "↓"} {String(Math.abs(pct)).replace(".", ",")}%
    </span>
  );
}

export function WorkoutCard({
  w,
  summary,
  who,
  prs = [],
  reactions,
  comments = 0,
  dateStyle = "ago",
  latestComments = [],
  maxExercises = 3,
  whenLabel,
  reactedBy,
}: {
  whenLabel?: string;
  reactedBy?: string;
  latestComments?: { id: string; name: string; body: string }[];
  maxExercises?: number;
  w: Workout;
  summary: WorkoutSummary | null;
  who?: { id: string; name: string; isMe: boolean } | null;
  prs?: PR[];
  reactions?: ReactionState;
  comments?: number;
  dateStyle?: "ago" | "day";
}) {
  const pride = who && themeFor(who.id) === "pride";
  const when = whenLabel ?? (dateStyle === "ago" ? timeAgo(w.completed_at ?? w.started_at) : formatDay(dayKey(w.started_at)));
  const cardio = w.day_type === "cardio";

  return (
    <article className={`card overflow-hidden ${pride ? "pride-row" : ""}`}>
      <Link href={cardio ? "#" : `/training/${w.id}/klaar`} className={`block p-3 ${cardio ? "pointer-events-none" : ""}`}>
        <div className="flex items-baseline gap-2">
          <p className="flex-1">
            {who && (
              <>
                <span className="font-semibold">{who.isMe ? "Jij" : <CrewName userId={who.id} name={who.name} />}</span>{" "}
                <span className="text-mute">deed </span>
              </>
            )}
            {cardio ? (
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <HeartPulse size={15} className="text-go" /> {w.cardio_description}
              </span>
            ) : (
              <DayTag day={w.day_type} />
            )}
          </p>
          <span className="shrink-0 text-xs text-mute">{when}</span>
          {!cardio && <ChevronRight size={16} className="shrink-0 self-center text-mute" aria-hidden />}
        </div>

        {cardio ? (
          w.cardio_minutes ? <p className="mt-1 text-sm text-mute">{w.cardio_minutes} min</p> : null
        ) : w.quick_check ? (
          <p className="mt-1 text-sm text-mute">Afgevinkt zonder sets</p>
        ) : summary ? (
          <>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
              {summary.minutes !== null && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} aria-hidden /> {summary.minutes} min
                </span>
              )}
              <span>{summary.setCount} sets</span>
              {summary.volume > 0 && <span>{fmtKg(summary.volume)} volume</span>}
            </p>
            {summary.exercises.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm">
                {summary.exercises.slice(0, maxExercises).map((e) => (
                  <li key={e.exerciseId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{EXERCISE_MAP[e.exerciseId]?.name ?? e.exerciseId}</span>
                    <span className="display text-base font-semibold">
                      {formatLoad(e.exerciseId, Number(e.best.weight_kg))} × {e.best.reps}
                    </span>
                    <DeltaBadge pct={e.deltaPct} />
                  </li>
                ))}
                {summary.exercises.length > maxExercises && (
                  <li className="text-mute">
                    en nog {summary.exercises.length - maxExercises} {summary.exercises.length - maxExercises === 1 ? "oefening" : "oefeningen"}
                  </li>
                )}
              </ul>
            )}
          </>
        ) : null}

        {w.notes && (
          <p className="mt-2 rounded-lg bg-floor px-3 py-2 text-sm">
            <span className="text-mute">Notitie: </span>&ldquo;{w.notes}&rdquo;
          </p>
        )}

        {prs.length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-pin-deep">
            <Trophy size={14} aria-hidden />
            {prs.length === 1
              ? `Record ${EXERCISE_MAP[prs[0].exerciseId]?.name}: ${formatLoad(prs[0].exerciseId, prs[0].weight)} × ${prs[0].reps}`
              : `${prs.length} nieuwe records`}
          </p>
        )}
      </Link>

      {latestComments.length > 0 && (
        <Link href={`/training/${w.id}/klaar#reacties`} className="block space-y-1 border-t border-line px-3 py-2 text-sm">
          {latestComments.map((c) => (
            <p key={c.id} className="line-clamp-2">
              <span className="font-semibold">{c.name}</span> {c.body}
            </p>
          ))}
          {comments > latestComments.length && <p className="text-xs text-mute">Alle {comments} reacties bekijken</p>}
        </Link>
      )}

      {reactions && !cardio && (
        <div className="flex items-center gap-2 border-t border-line px-3 py-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Reactions workoutId={w.id} state={reactions} compact />
            {reactedBy && <span className="truncate text-xs text-mute">{reactedBy}</span>}
          </div>
          <Link href={`/training/${w.id}/klaar#reacties`} className="inline-flex items-center gap-1 text-sm text-mute">
            <MessageCircle size={15} aria-hidden /> {comments > 0 ? comments : "Reageer"}
          </Link>
        </div>
      )}
    </article>
  );
}
