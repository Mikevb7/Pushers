"use client";

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
            level: String(f.get("level")),
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

  const field = "w-full rounded-lg border border-line bg-steel px-3.5 py-3 text-chalk placeholder:text-mute/70 focus:border-pin focus:outline-none";

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-10">
        <p className="display text-[5.5rem] font-bold">Pushers</p>
        <p className="mt-3 text-mute">Eén schema voor de hele crew, ieder zijn eigen progressie.</p>
      </div>

      <div className="mb-6 grid grid-cols-2 rounded-lg bg-steel p-1" role="tablist">
        {(["in", "nieuw"] as Mode[]).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`rounded-md py-2.5 font-semibold ${mode === m ? "bg-steel-2 text-chalk" : "text-mute"}`}
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
            <fieldset className="pt-1">
              <legend className="mb-2 text-sm text-mute">Hoe lang train je al?</legend>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ["beginner", "Net begonnen"],
                  ["gevorderd", "Al een tijdje"],
                ].map(([v, l]) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-steel px-3 py-3 has-[:checked]:border-pin">
                    <input type="radio" name="level" value={v} defaultChecked={v === "beginner"} className="accent-pin" />
                    {l}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {error && <p className="rounded-lg bg-pin-dim/60 px-3 py-2.5 text-sm text-chalk">{error}</p>}
        {info && <p className="rounded-lg bg-steel-2 px-3 py-2.5 text-sm text-chalk">{info}</p>}

        <button disabled={busy} className="mt-2 w-full rounded-lg bg-pin py-3.5 text-lg font-semibold text-floor disabled:opacity-60">
          {busy ? "Even geduld…" : mode === "in" ? "Inloggen" : "Account maken"}
        </button>
      </form>
    </main>
  );
}
