import { requireMe } from "@/lib/data";
import { signOut, updateProfile } from "@/app/actions";

export default async function ProfilePage() {
  const { profile, user } = await requireMe();
  const field = "w-full rounded-lg border border-line bg-steel px-3.5 py-3";
  return (
    <div className="space-y-6">
      <header className="pt-2">
        <h1 className="display text-6xl font-bold">Profiel</h1>
        <p className="mt-1 text-sm text-mute">{user.email}</p>
      </header>

      <form action={updateProfile} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm text-mute">Naam</span>
          <input name="display_name" defaultValue={profile.display_name} required className={field} />
        </label>
        <fieldset>
          <legend className="mb-1 text-sm text-mute">Niveau</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["beginner", "Beginner"],
              ["gevorderd", "Gevorderd"],
            ].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 rounded-lg border border-line bg-steel px-3 py-3 has-[:checked]:border-pin">
                <input type="radio" name="level" value={v} defaultChecked={profile.level === v} className="accent-pin" />
                {l}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-mute">Beginners doen de eerste 4 weken 1 set minder per oefening.</p>
        </fieldset>
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
        <button className="w-full rounded-xl bg-pin py-3.5 font-semibold text-floor">Opslaan</button>
      </form>

      <form action={signOut}>
        <button className="w-full rounded-xl bg-steel py-3 font-semibold text-mute">Uitloggen</button>
      </form>
    </div>
  );
}
