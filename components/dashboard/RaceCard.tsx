import { CATEGORY_LABELS } from "@/lib/dashboard/labels";
import type { RaceView } from "@/lib/dashboard/types";

import { PredictionField } from "./PredictionField";

/** Format an ISO race date as e.g. "8 Mar 2026"; blank when unknown. */
function formatRaceDate(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * One race's detail: each person's predictions per category, and — for a
 * completed race — the actual outcome column plus each person's score. Laid out
 * as a table (category rows × person columns) that scrolls horizontally on
 * narrow screens.
 */
export function RaceCard({ race }: { race: RaceView }) {
  const dateLabel = formatRaceDate(race.raceDate);

  return (
    <article className="rounded-lg border border-off-white/10 bg-asphalt-highlight/50 p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-heading text-lg font-bold text-off-white">
          {race.name}
        </h3>
        <div className="flex items-center gap-3 text-xs text-off-white/50">
          {dateLabel && <span>{dateLabel}</span>}
          <span
            className={
              race.isCompleted
                ? "rounded-full bg-correct-green/15 px-2 py-0.5 font-semibold uppercase tracking-wide text-correct-green"
                : "rounded-full bg-off-white/10 px-2 py-0.5 font-semibold uppercase tracking-wide text-off-white/60"
            }
          >
            {race.isCompleted ? "Completed" : "Upcoming"}
          </span>
        </div>
      </header>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-off-white/45">
              <th scope="col" className="py-2 pr-4 font-medium">
                Category
              </th>
              {race.people.map((person) => (
                <th
                  key={person.userId}
                  scope="col"
                  className="py-2 pr-4 font-medium"
                >
                  {person.displayName}
                </th>
              ))}
              {race.actual && (
                <th scope="col" className="py-2 pr-4 font-medium text-off-white/70">
                  Result
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {CATEGORY_LABELS.map(({ key, label }) => (
              <tr
                key={key}
                className="border-t border-off-white/5 align-baseline"
              >
                <th
                  scope="row"
                  className="py-2 pr-4 text-left font-medium text-off-white/60"
                >
                  {label}
                </th>
                {race.people.map((person) => (
                  <td key={person.userId} className="py-2 pr-4">
                    <PredictionField field={person.fields[key]} />
                  </td>
                ))}
                {race.actual && (
                  <td className="py-2 pr-4">
                    <PredictionField field={race.actual[key]} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {race.isCompleted && (
        <footer className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-t border-off-white/5 pt-3 text-xs text-off-white/60">
          {race.people.map((person) =>
            person.score ? (
              <span key={person.userId}>
                <span className="text-off-white/80">{person.displayName}:</span>{" "}
                {person.score.points}/{person.score.maxPoints} pts
              </span>
            ) : null,
          )}
        </footer>
      )}
    </article>
  );
}
