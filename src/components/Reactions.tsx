"use client";

import { useOptimistic, useTransition } from "react";
import { toggleReaction } from "@/app/actions";
import { REACTIONS, type Reaction } from "@/lib/types";
import type { ReactionState } from "@/lib/social";


export function Reactions({ workoutId, state, compact = false }: { workoutId: string; state: ReactionState; compact?: boolean }) {
  const [, start] = useTransition();
  const [opt, toggle] = useOptimistic(state, (s, emoji: Reaction) => {
    const had = s.mine.includes(emoji);
    return {
      counts: { ...s.counts, [emoji]: Math.max(0, (s.counts[emoji] ?? 0) + (had ? -1 : 1)) },
      mine: had ? s.mine.filter((e) => e !== emoji) : [...s.mine, emoji],
    };
  });

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1" : "gap-1.5"}`}>
      {REACTIONS.map((e) => {
        const n = opt.counts[e] ?? 0;
        const on = opt.mine.includes(e);
        if (compact && n === 0 && e !== "💪") return null;
        return (
          <button
            key={e}
            type="button"
            aria-pressed={on}
            aria-label={`${e} ${n}`}
            onClick={(ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              start(async () => {
                toggle(e);
                await toggleReaction(workoutId, e);
              });
            }}
            className={`inline-flex items-center gap-1 rounded-full border text-sm transition-colors ${
              compact ? "px-2 py-0.5" : "px-3 py-1.5"
            } ${on ? "border-pin bg-pin-dim font-semibold" : "border-line bg-steel"}`}
          >
            <span aria-hidden>{e}</span>
            {n > 0 && <span className="tabular-nums">{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
