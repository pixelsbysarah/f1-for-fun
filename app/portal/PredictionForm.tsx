"use client";

import { CheckCircleIcon, PencilSquareIcon } from "@heroicons/react/24/outline";
import { useState, useTransition } from "react";

import type { PredictionFields, Race } from "@/lib/predictions/types";

import { savePrediction, type SaveResult } from "./actions";

/** Turn a nullable stored value into a controlled-input string. */
function toInput(value: string | number | null): string {
  return value === null || value === undefined ? "" : String(value);
}

/**
 * Per-race prediction form. Enters/edits P1–P3, fastest lap, DNF count, and
 * red-flag count, then persists via the `savePrediction` server action (which
 * re-validates and writes under RLS). Field-level errors returned by the action
 * are shown inline.
 */
export function PredictionForm({
  race,
  initial,
}: {
  race: Race;
  initial: PredictionFields | null;
}) {
  const [fields, setFields] = useState({
    p1Driver: toInput(initial?.p1Driver ?? null),
    p2Driver: toInput(initial?.p2Driver ?? null),
    p3Driver: toInput(initial?.p3Driver ?? null),
    fastestLapDriver: toInput(initial?.fastestLapDriver ?? null),
    dnfCount: toInput(initial?.dnfCount ?? null),
    redFlagCount: toInput(initial?.redFlagCount ?? null),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function update(name: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
    setStatus("idle");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage(null);

    startTransition(async () => {
      const result: SaveResult = await savePrediction(race.id, fields);
      if (result.ok) {
        setStatus("saved");
        return;
      }
      setStatus("error");
      if ("errors" in result) {
        setErrors(result.errors);
      } else {
        setMessage(result.message);
      }
    });
  }

  const hasExisting = initial != null;

  const driverFields: Array<{ name: keyof typeof fields; label: string }> = [
    { name: "p1Driver", label: "P1" },
    { name: "p2Driver", label: "P2" },
    { name: "p3Driver", label: "P3" },
    { name: "fastestLapDriver", label: "Fastest lap" },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-off-white/10 bg-asphalt-highlight/60 p-5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-off-white">
          {hasExisting && (
            <PencilSquareIcon
              className="h-4 w-4 shrink-0 text-off-white/50"
              aria-hidden="true"
            />
          )}
          {race.name}
        </h2>
        <span className="text-xs text-off-white/50">Round {race.round}</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {driverFields.map(({ name, label }) => (
          <label key={name} className="flex flex-col gap-1 text-sm">
            <span className="text-off-white/80">{label}</span>
            <input
              type="text"
              value={fields[name]}
              onChange={(e) => update(name, e.target.value)}
              className="rounded border border-off-white/20 bg-asphalt px-3 py-2 text-off-white outline-none focus:border-racing-red"
            />
            {errors[name] && (
              <span role="alert" className="text-xs text-racing-red">
                {errors[name]}
              </span>
            )}
          </label>
        ))}

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-off-white/80">DNF count</span>
          <input
            type="number"
            min={0}
            max={22}
            value={fields.dnfCount}
            onChange={(e) => update("dnfCount", e.target.value)}
            className="rounded border border-off-white/20 bg-asphalt px-3 py-2 text-off-white outline-none focus:border-racing-red"
          />
          {errors.dnfCount && (
            <span role="alert" className="text-xs text-racing-red">
              {errors.dnfCount}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-off-white/80">Red flags</span>
          <input
            type="number"
            min={0}
            max={10}
            value={fields.redFlagCount}
            onChange={(e) => update("redFlagCount", e.target.value)}
            className="rounded border border-off-white/20 bg-asphalt px-3 py-2 text-off-white outline-none focus:border-racing-red"
          />
          {errors.redFlagCount && (
            <span role="alert" className="text-xs text-racing-red">
              {errors.redFlagCount}
            </span>
          )}
        </label>
      </div>

      {errors.podium && (
        <p role="alert" className="mt-3 text-sm text-racing-red">
          {errors.podium}
        </p>
      )}
      {status === "error" && message && (
        <p role="alert" className="mt-3 text-sm text-racing-red">
          {message}
        </p>
      )}
      {status === "saved" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-correct-green">
          <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
          Saved.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded bg-racing-red px-4 py-2 text-sm font-semibold text-off-white transition-colors hover:bg-racing-red/90 disabled:opacity-60"
      >
        <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
        {pending ? "Saving…" : hasExisting ? "Update prediction" : "Save prediction"}
      </button>
    </form>
  );
}
