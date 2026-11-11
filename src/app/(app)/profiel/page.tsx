import Link from "next/link";
import { BookOpen, Check, ChevronRight } from "lucide-react";
import { requireMe } from "@/lib/data";
import { PROGRAMS, programOf } from "@/lib/schedule";
import { setProgram, signOut, updateProfile } from "@/app/actions";

export default async function ProfilePage() {
  const { profile, user } = await requireMe();
  const field = "w-full rounded-lg border border-line bg-steel px-3.5 py-3";
  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold uppercase">Profiel</h1>
        <p className="mt-1 text-sm text-mute">{user.email}</p>
      </header>

      <form action={updateProfile} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-mute">Naam</span>
          <input name="display_name" defaultValue={profile.display_name} required className={field} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm text-mute">Lichaamsgewicht (kg)</span>
          <input name="bodyweight_kg" inputMode="decimal" defaultValue={String(profile.bodyweight_kg).replace(".", ",")} className={field} />
          <span className="mt-1 block text-xs text-mute">Telt mee bij pull-ups en dips.</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-sm text-mute">Waterdoel (ml)</span>
            <input name="water_goal_ml" inputMode="numeric" defaultValue={profile.water_goal_ml} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-mute">Eén glas (ml)</span>
            <input name="glass_ml" inputMode="numeric" defaultValue={profile.glass_ml} className={field} />
          </label>
        </div>
        <button className="w-full rounded-full bg-pin py-3.5 font-semibold text-chalk">Opslaan</button>
      </form>

      <section className="space-y-2">
        <h2 className="display text-2xl font-semibold uppercase">Schema</h2>
        <p className="text-sm text-mute">Geldt vanaf je volgende training. Je oude trainingen blijven zoals ze waren.</p>
        {Object.values(PROGRAMS).map((p) => {
          const on = programOf(profile.program).id === p.id;
          return (
            <form key={p.id} action={setProgram}>
              <input type="hidden" name="program" value={p.id} />
              <button
                disabled={on}
                className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left ${on ? "border-pin bg-pin-dim/30" : "border-line bg-steel"}`}
              >
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border ${on ? "border-pin bg-pin text-chalk" : "border-line"}`}>
                  {on && <Check size={13} />}
                </span>
                <span>
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-sm text-mute">{p.description}</span>
                </span>
              </button>
            </form>
          );
        })}
      </section>

      <Link href="/oefeningen" className="card flex items-center gap-3 p-4">
        <BookOpen size={20} className="text-pin-deep" aria-hidden />
        <span className="flex-1">
          <span className="block font-semibold">Oefeningenbibliotheek</span>
          <span className="block text-sm text-mute">Alle oefeningen met uitleg, filter op spiergroep</span>
        </span>
        <ChevronRight size={18} className="text-mute" aria-hidden />
      </Link>

      <form action={signOut}>
        <button className="w-full card py-3 font-semibold text-mute">Uitloggen</button>
      </form>
    </div>
  );
}
