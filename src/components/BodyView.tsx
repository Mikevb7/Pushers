import Link from "next/link";
import { Trash2 } from "lucide-react";
import { addDays, formatDay } from "@/lib/dates";
import { RANGES, weightSummary, weightTrend, type RangeId } from "@/lib/weight";
import { deleteWeight, logWeight } from "@/app/actions";
import { SubmitButton } from "./SubmitButton";
import { WeightChart } from "./WeightChart";

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

export function BodyView({
  weights,
  mine,
  name,
  today,
  range,
  hrefForRange,
}: {
  weights: { day: string; kg: number }[];
  mine: boolean;
  name: string;
  today: string;
  range: RangeId;
  hrefForRange: (r: RangeId) => string;
}) {
  const r = RANGES.find((x) => x.id === range)!;
  const from = r.days ? addDays(today, -r.days) : (weights[0]?.day ?? today);
  // Voor de trend ook een week ervóór meenemen, zodat de lijn aan het begin klopt.
  const inRange = weights.filter((w) => w.day >= from);
  const trendAll = weightTrend(weights.filter((w) => w.day >= addDays(from, -7)));
  const trend = trendAll ? trendAll.filter((w) => w.day >= from) : null;
  const sum = weightSummary(weights, today);

  return (
    <div className="space-y-5">
      <section className="card p-4">
        {sum ? (
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm text-mute">{sum.usesTrend ? "Gewicht (7-daags gemiddelde)" : "Laatst gewogen"}</p>
              <p className="display text-6xl font-bold">
                {fmt(sum.current)}
                <span className="ml-1 text-2xl text-mute">kg</span>
              </p>
              <p className="text-xs text-mute">
                Laatste meting {fmt(sum.lastLogged.kg)} kg op {formatDay(sum.lastLogged.day)}
              </p>
            </div>
            {sum.change !== null && (
              <div className="text-right">
                <p className="display text-3xl font-bold">
                  {sum.change > 0 ? "+" : ""}
                  {fmt(sum.change)} kg
                </p>
                <p className="text-xs text-mute">in {sum.changeDays} dagen</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-mute">{mine ? "Nog geen gewicht gelogd. Vul hieronder je eerste meting in." : `${name} heeft nog geen gewicht gelogd.`}</p>
        )}

        {mine && (
          <form action={logWeight} className="mt-4 flex items-end gap-2">
            <label className="flex-1">
              <span className="mb-1 block text-xs text-mute">Gewicht (kg)</span>
              <input
                name="kg"
                inputMode="decimal"
                required
                placeholder={sum ? fmt(sum.lastLogged.kg) : "70,0"}
                className="display w-full rounded-xl border border-line bg-floor px-3 py-2.5 text-center text-2xl font-semibold"
              />
            </label>
            <label className="w-36">
              <span className="mb-1 block text-xs text-mute">Datum</span>
              <input name="day" type="date" defaultValue={today} max={today} className="w-full rounded-xl border border-line bg-floor px-2 py-3 text-sm" />
            </label>
            <SubmitButton pendingText="…" className="rounded-xl bg-pin px-4 py-3 font-semibold text-chalk">
              Opslaan
            </SubmitButton>
          </form>
        )}
      </section>

      {weights.length > 0 && (
        <section className="card p-3">
          <div className="mb-2 grid grid-cols-3 rounded-lg bg-floor p-1">
            {RANGES.map((x) => (
              <Link
                key={x.id}
                href={hrefForRange(x.id)}
                scroll={false}
                className={`rounded-md py-1.5 text-center text-sm font-semibold ${x.id === range ? "bg-steel shadow-sm" : "text-mute"}`}
              >
                {x.label}
              </Link>
            ))}
          </div>
          {inRange.length ? (
            <WeightChart points={inRange} trend={trend} from={from} to={today} />
          ) : (
            <p className="py-8 text-center text-sm text-mute">Geen metingen in deze periode.</p>
          )}
          <p className="mt-1 text-xs text-mute">
            {trend
              ? "Lichte puntjes zijn je metingen, de lijn is je 7-daags gemiddelde. Dagelijkse schommelingen van 1-2 kg zijn water en eten, de lijn is je echte gewicht."
              : "Elk punt is een meting, op de echte datum. Weeg je vaker (om de paar dagen), dan verschijnt er een trendlijn."}
          </p>
        </section>
      )}

      {mine && weights.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Metingen</h2>
          <ul className="space-y-1.5">
            {[...weights]
              .reverse()
              .slice(0, 10)
              .map((w) => (
                <li key={w.day} className="flex items-center gap-3 rounded-lg bg-steel px-3 py-2 text-sm">
                  <span className="flex-1 text-mute">{formatDay(w.day)}</span>
                  <span className="display text-lg font-semibold">{fmt(w.kg)} kg</span>
                  <form action={deleteWeight.bind(null, w.day)}>
                    <button aria-label={`Meting van ${w.day} verwijderen`} className="p-1 text-mute">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}
