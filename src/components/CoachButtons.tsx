"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export function CoachButtons({ nextDayLabel }: { nextDayLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "weekly" | "today">(null);
  const [error, setError] = useState<string | null>(null);

  async function ask(kind: "weekly" | "today") {
    setBusy(kind);
    setError(null);
    try {
      const res = await fetch("/api/coach", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind }) });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Er ging iets mis.");
      else router.refresh();
    } catch {
      setError("Geen verbinding. Probeer het opnieuw.");
    }
    setBusy(null);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => ask("today")}
        disabled={!!busy}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-pin py-3.5 font-semibold text-chalk disabled:opacity-60"
      >
        <Sparkles size={18} />
        {busy === "today" ? "Coach denkt na…" : `Advies voor ${nextDayLabel}`}
      </button>
      <button onClick={() => ask("weekly")} disabled={!!busy} className="w-full rounded-xl bg-steel-2 py-3.5 font-semibold disabled:opacity-60">
        {busy === "weekly" ? "Coach analyseert je week…" : "Nieuwe weekanalyse"}
      </button>
      {error && <p className="rounded-lg bg-pin-dim/60 px-3 py-2.5 text-sm">{error}</p>}
    </div>
  );
}
