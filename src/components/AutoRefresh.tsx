"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { crewPulse } from "@/app/actions";

/**
 * Houdt de pagina actueel zolang hij in beeld is (voor "nu bezig").
 * Elke N seconden een heel kleine check; alleen als er echt iets veranderd is
 * (nieuwe set, training afgerond, reactie) wordt de hele pagina opnieuw geladen.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const last = useRef<string | null>(null);
  useEffect(() => {
    let alive = true;
    async function check() {
      if (document.visibilityState !== "visible") return;
      try {
        const now = await crewPulse();
        if (!alive) return;
        if (last.current !== null && now !== last.current) router.refresh();
        last.current = now;
      } catch {
        // Geen verbinding: volgende keer opnieuw.
      }
    }
    check();
    const t = setInterval(check, seconds * 1000);
    // Lang weggeweest (app op de achtergrond)? Dan altijd vers laden, ook voor tijden als "20 min bezig".
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000) {
        last.current = null;
        router.refresh();
      }
      else check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, seconds]);
  return null;
}
