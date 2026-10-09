"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "in" | "nieuw";

function niceError(msg: string): string {
  if (/invalid login/i.test(msg)) return "E-mail of wachtwoord klopt niet.";
  if (/uitnodigingscode|database error saving new user/i.test(msg)) return "Uitnodigingscode klopt niet. Vraag hem aan Mike.";
  if (/already registered/i.test(msg)) return "Dit e-mailadres heeft al een account. Log in.";
  if (/password/i.test(msg)) return "Wachtwoord moet minstens 6 tekens zijn.";
  if (/email not confirmed/i.test(msg)) return "Bevestig eerst je e-mail via de link in je inbox.";
  return msg;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("in");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim();
    const password = String(f.get("password"));
    const supabase = createClient();

    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(niceError(error.message));
        setBusy(false);
        return;
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: String(f.get("name")).trim(),
            invite_code: String(f.get("code")).trim(),
          },
        },
      });
      if (error) {
        setError(niceError(error.message));
        setBusy(false);
        return;
      }
      if (!data.session) {
        setInfo("Account gemaakt. Bevestig je e-mail via de link in je inbox en log daarna in.");
        setMode("in");
        setBusy(false);
        return;
      }
    }
    router.replace("/");
    router.refresh();
  }

  const field = "w-full rounded-full border border-line bg-steel px-5 py-3.5 text-chalk placeholder:text-mute/80 focus:border-pin-deep focus:outline-none";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-night text-white">
        <Image src="/equipment/evolve-cable.webp" alt="" fill priority sizes="448px" className="object-cover opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-night/20 to-night/90" />
        <div className="relative flex min-h-[17rem] flex-col justify-end p-5">
          <p className="display text-[4.75rem] font-bold uppercase leading-[0.85]">Pushers</p>
          <p className="mt-3 text-white/80">Eén schema voor de hele crew, ieder zijn eigen progressie.</p>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 rounded-full bg-steel-2 p-1" role="tablist">
        {(["in", "nieuw"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-full py-2.5 font-semibold ${mode === m ? "bg-steel text-chalk shadow-sm" : "text-mute"}`}
          >
            {m === "in" ? "Inloggen" : "Account maken"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        {mode === "nieuw" && (
          <input name="name" required placeholder="Je naam" autoComplete="given-name" className={field} />
        )}
        <input name="email" type="email" required placeholder="E-mail" autoComplete="email" className={field} />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          placeholder="Wachtwoord"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          className={field}
        />
        {mode === "nieuw" && (
          <>
            <input name="code" required placeholder="Uitnodigingscode" autoCapitalize="off" className={field} />
          </>
        )}

        {error && <p className="rounded-lg bg-pin-dim/60 px-3 py-2.5 text-sm text-chalk">{error}</p>}
        {info && <p className="rounded-lg bg-steel-2 px-3 py-2.5 text-sm text-chalk">{info}</p>}

        <button disabled={busy} className="mt-2 w-full rounded-full bg-pin py-3.5 text-lg font-semibold text-chalk disabled:opacity-60">
          {busy ? "Even geduld…" : mode === "in" ? "Inloggen" : "Account maken"}
        </button>
      </form>
    </main>
  );
}
