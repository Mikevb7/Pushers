import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/data";
import { ExerciseLibrary } from "@/components/ExerciseLibrary";

export const metadata = { title: "Oefeningen" };

export default async function ExercisesPage() {
  await requireUser();
  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/" aria-label="Terug" className="p-1 text-mute">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <h1 className="display text-5xl font-bold uppercase leading-none">Oefeningen</h1>
          <p className="mt-1 text-sm text-mute">Alles wat je in de gym kunt doen. In een training voeg je ze toe als bonusoefening.</p>
        </div>
      </header>
      <ExerciseLibrary />
    </div>
  );
}
