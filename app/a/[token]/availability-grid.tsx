"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveDay } from "./actions";
import { SAVE_DAY_IDLE, type DayChoiceValue, type GridDay, type GridLabels, type SaveDayState } from "./state";

/**
 * The fortnight the promoter sets, one row per day.
 *
 * Saves on the tap. There is no Save button at the bottom, deliberately: this is opened on a
 * phone, on the bus, and a fortnight of choices that are lost because the page was closed before
 * scrolling to the end is worse than fourteen small round trips. Each row reports its own
 * outcome, so a failure on the 9th never silently takes the 8th with it.
 *
 * Every string arrives translated from the server, and so do the hour lists — this module must
 * not import `lib/availability-links.ts`, which reaches `node:crypto`.
 */

const BTN =
  "flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors disabled:opacity-50";

function choiceClasses(active: boolean, tone: "ok" | "bad" | "warn"): string {
  if (!active) {
    return `${BTN} border-[color:var(--color-line)] bg-[color:var(--color-surface)] text-[color:var(--color-muted)]`;
  }
  const bg =
    tone === "ok"
      ? "bg-[color:var(--color-ok)]"
      : tone === "bad"
        ? "bg-[color:var(--color-bad)]"
        : "bg-[color:var(--color-warn)]";
  return `${BTN} border-transparent ${bg} text-[color:var(--color-surface)]`;
}

export function AvailabilityGrid({
  token,
  days,
  labels,
  startTimes,
  endTimes,
}: {
  token: string;
  days: GridDay[];
  labels: GridLabels;
  startTimes: string[];
  endTimes: string[];
}) {
  const [state, setState] = useState<SaveDayState>(SAVE_DAY_IDLE);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function submit(date: string, choice: DayChoiceValue, from: string | null, to: string | null) {
    setBusyDate(date);
    setState(SAVE_DAY_IDLE);
    startTransition(async () => {
      const result = await saveDay(token, date, choice, from, to);
      setBusyDate(null);
      setState(result);
      if (result.status === "saved") {
        setEditing(null);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState(SAVE_DAY_IDLE), 2500);
      }
    });
  }

  return (
    <ul className="mt-6 space-y-2">
      {days.map((day) => {
        const busy = busyDate === day.date;
        const saved = state.status === "saved" && state.date === day.date;
        const error = state.status === "error" && state.date === day.date ? state.reason : null;
        const open = editing === day.date;

        return (
          <li
            key={day.date}
            className={`rounded-xl border p-3 shadow-[var(--shadow-xs)] ${
              day.isToday
                ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-subtle)]"
                : "border-[color:var(--color-line)] bg-[color:var(--color-surface)]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold">
                <span className={day.isWeekend ? "text-[color:var(--color-accent)]" : undefined}>
                  {day.weekday}
                </span>{" "}
                <span className="text-[color:var(--color-muted)]">{day.dayLabel}</span>
              </p>
              <p className="text-right text-xs text-[color:var(--color-muted)]">
                {busy ? labels.saving : saved ? <span className="text-[color:var(--color-ok)]">✓ {labels.saved}</span> : day.summary}
              </p>
            </div>

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busy}
                aria-pressed={day.choice === "available"}
                onClick={() => submit(day.date, "available", null, null)}
                className={choiceClasses(day.choice === "available", "ok")}
              >
                {labels.available}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={day.choice === "partial"}
                onClick={() => setEditing(open ? null : day.date)}
                className={choiceClasses(day.choice === "partial", "warn")}
              >
                {labels.partial}
              </button>
              <button
                type="button"
                disabled={busy}
                aria-pressed={day.choice === "unavailable"}
                onClick={() => submit(day.date, "unavailable", null, null)}
                className={choiceClasses(day.choice === "unavailable", "bad")}
              >
                {labels.unavailable}
              </button>
            </div>

            {open && (
              <PartialEditor
                labels={labels}
                startTimes={startTimes}
                endTimes={endTimes}
                initialFrom={day.fromTime}
                initialTo={day.toTime}
                busy={busy}
                onCancel={() => setEditing(null)}
                onApply={(from, to) => submit(day.date, "partial", from, to)}
              />
            )}

            {day.choice !== "clear" && !busy && (
              <button
                type="button"
                onClick={() => submit(day.date, "clear", null, null)}
                className="mt-2 text-xs text-[color:var(--color-muted)] underline underline-offset-2"
              >
                {labels.clear}
              </button>
            )}

            {day.source && day.source !== "self" && (
              <p className="mt-2 text-xs text-[color:var(--color-muted)]">{labels.byCoordinator}</p>
            )}
            {day.contradictory && (
              <p className="mt-1 text-xs text-[color:var(--color-warn)]">{labels.contradiction}</p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-xs text-[color:var(--color-bad)]">
                {labels.errors[error]}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function PartialEditor({
  labels,
  startTimes,
  endTimes,
  initialFrom,
  initialTo,
  busy,
  onCancel,
  onApply,
}: {
  labels: GridLabels;
  startTimes: string[];
  endTimes: string[];
  initialFrom: string | null;
  initialTo: string | null;
  busy: boolean;
  onCancel: () => void;
  onApply: (from: string, to: string | null) => void;
}) {
  const [from, setFrom] = useState(initialFrom ?? startTimes[11] ?? "17:00");
  const [to, setTo] = useState(initialTo ?? "");

  const selectClass =
    "w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-2 py-2 text-sm";

  return (
    <div className="mt-3 rounded-lg bg-[color:var(--color-canvas)] p-3">
      <div className="flex gap-3">
        <label className="flex-1 text-xs text-[color:var(--color-muted)]">
          {labels.from}
          <select
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={`mt-1 ${selectClass}`}
          >
            {startTimes.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1 text-xs text-[color:var(--color-muted)]">
          {labels.to}
          <select
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={`mt-1 ${selectClass}`}
          >
            <option value="">{labels.endOfDay}</option>
            {endTimes.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply(from, to === "" ? null : to)}
          className="flex-1 rounded-lg bg-[color:var(--color-accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[color:var(--color-accent-hover)] disabled:opacity-50"
        >
          {busy ? labels.saving : labels.apply}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[color:var(--color-line)] px-3 py-2 text-sm"
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  );
}
