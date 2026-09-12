"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Badge, Button, Card, SelectField, type BadgeVariant } from "@/components/ui";
import { saveDay, runBulkAvailability } from "./actions";
import {
  BULK_IDLE,
  SAVE_DAY_IDLE,
  type BulkKind,
  type BulkLabels,
  type BulkState,
  type DayChoiceValue,
  type GridDay,
  type GridLabels,
  type SaveDayState,
} from "./state";

/**
 * P5 — the coordinator's fortnight for one promoter.
 *
 * Structurally the mirror of `app/a/[token]/availability-grid.tsx` (saves on the tap, one row
 * reports its own outcome so a failure on the 9th never takes the 8th with it), plus two things
 * that only make sense on the coordinator's side:
 *
 *  - a bulk-entry toolbar ("all weekdays" / "this weekend" / "clear the fortnight"), because
 *    setting fourteen days one click at a time is the reason people stay in spreadsheets;
 *  - a visible, distinct `source` badge on every day, because a coordinator is about to overwrite
 *    whatever is there and must be able to tell at a glance whether that is nothing, her own past
 *    entry, or something the promoter said herself on `/a/[token]`.
 *
 * Every string and the hour lists arrive from the server (`page.tsx`), same reason as the
 * promoter's own grid: this file must not import `lib/availability-links.ts`, which reaches
 * `node:crypto`.
 */

const STATE_BADGE: Record<Exclude<DayChoiceValue, never>, BadgeVariant> = {
  available: "ok",
  partial: "warn",
  unavailable: "bad",
  clear: "neutral",
};

function stateLabel(choice: DayChoiceValue, labels: GridLabels): string {
  if (choice === "available") return labels.available;
  if (choice === "partial") return labels.partial;
  if (choice === "unavailable") return labels.unavailable;
  return labels.undeclared;
}

export function AvailabilityGrid({
  promoterId,
  days,
  labels,
  bulkLabels,
  startTimes,
  endTimes,
}: {
  promoterId: string;
  days: GridDay[];
  labels: GridLabels;
  bulkLabels: BulkLabels;
  startTimes: string[];
  endTimes: string[];
}) {
  const [state, setState] = useState<SaveDayState>(SAVE_DAY_IDLE);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const dayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bulkState, setBulkState] = useState<BulkState>(BULK_IDLE);
  const [busyBulk, setBusyBulk] = useState<BulkKind | null>(null);
  const [, startBulkTransition] = useTransition();
  const bulkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * `clear_all` deletes a fortnight in one tap, including days the promoter declared herself on
   * `/a/[token]`, and there is no undo — availability rows are deleted, not soft-deleted. So the
   * button arms first and fires on the second tap. Deliberately not `window.confirm`: that is
   * unstyled, untranslatable, and on a phone it is the dialog people dismiss without reading.
   */
  const [clearArmed, setClearArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promoterSetSomeDay = days.some((d) => d.source === "self");

  useEffect(() => {
    return () => {
      if (dayTimer.current) clearTimeout(dayTimer.current);
      if (bulkTimer.current) clearTimeout(bulkTimer.current);
      if (armTimer.current) clearTimeout(armTimer.current);
    };
  }, []);

  function submit(date: string, choice: DayChoiceValue, from: string | null, to: string | null) {
    setBusyDate(date);
    setState(SAVE_DAY_IDLE);
    startTransition(async () => {
      const result = await saveDay(promoterId, date, choice, from, to);
      setBusyDate(null);
      setState(result);
      if (result.status === "saved") {
        setEditing(null);
        if (dayTimer.current) clearTimeout(dayTimer.current);
        dayTimer.current = setTimeout(() => setState(SAVE_DAY_IDLE), 2500);
      }
    });
  }

  function disarmClear() {
    if (armTimer.current) clearTimeout(armTimer.current);
    setClearArmed(false);
  }

  /** First tap arms, second tap clears. The armed state lapses on its own so it cannot be hit later by accident. */
  function onClearClick() {
    if (clearArmed) {
      runBulk("clear_all");
      return;
    }
    setClearArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setClearArmed(false), 6000);
  }

  function runBulk(kind: BulkKind) {
    disarmClear();
    setBusyBulk(kind);
    setBulkState(BULK_IDLE);
    startBulkTransition(async () => {
      const result = await runBulkAvailability(promoterId, kind);
      setBusyBulk(null);
      setBulkState(result);
      if (result.status === "done") {
        if (bulkTimer.current) clearTimeout(bulkTimer.current);
        bulkTimer.current = setTimeout(() => setBulkState(BULK_IDLE), 3000);
      }
    });
  }

  const bulkBusy = busyBulk !== null;

  return (
    <div className="flex flex-col gap-4">
      <Card header={<h2 className="text-sm font-semibold text-[color:var(--color-ink)]">{bulkLabels.title}</h2>}>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            loading={busyBulk === "weekdays"}
            onClick={() => runBulk("weekdays")}
          >
            {bulkLabels.weekdays}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={bulkBusy}
            loading={busyBulk === "weekend"}
            onClick={() => runBulk("weekend")}
          >
            {bulkLabels.weekend}
          </Button>
          <Button
            type="button"
            variant={clearArmed ? "danger" : "ghost"}
            size="sm"
            disabled={bulkBusy}
            loading={busyBulk === "clear_all"}
            onClick={onClearClick}
          >
            {clearArmed ? bulkLabels.clearAllConfirm : bulkLabels.clearAll}
          </Button>
          {clearArmed ? (
            <Button type="button" variant="ghost" size="sm" disabled={bulkBusy} onClick={disarmClear}>
              {bulkLabels.clearAllCancel}
            </Button>
          ) : null}
        </div>
        {clearArmed ? (
          <p role="alert" className="mt-3 text-sm font-medium text-[color:var(--color-bad-ink)]">
            {promoterSetSomeDay ? bulkLabels.clearAllWarningSelf : bulkLabels.clearAllWarning}
          </p>
        ) : null}
        {bulkState.status === "done" ? (
          <p className="mt-3 text-sm text-[color:var(--color-ok-ink)]">{bulkLabels.done[bulkState.kind]}</p>
        ) : null}
        {bulkState.status === "error" ? (
          <p role="alert" className="mt-3 text-sm font-medium text-[color:var(--color-bad-ink)]">
            {bulkLabels.errors[bulkState.reason]}
          </p>
        ) : null}
      </Card>

      <ul className="flex flex-col gap-2">
        {days.map((day) => {
          const busy = busyDate === day.date;
          const saved = state.status === "saved" && state.date === day.date;
          const error = state.status === "error" && state.date === day.date ? state.reason : null;
          const open = editing === day.date;

          return (
            <li key={day.date}>
              <Card
                className={
                  day.isToday ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-subtle)]" : undefined
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      <span className={day.isWeekend ? "text-[color:var(--color-accent)]" : undefined}>
                        {day.weekday}
                      </span>{" "}
                      <span className="text-[color:var(--color-muted)]">{day.dayLabel}</span>
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--color-muted)]">
                      {busy ? labels.saving : saved ? labels.saved : day.summary}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge variant={STATE_BADGE[day.choice]} dot={day.choice === "clear"}>
                      {stateLabel(day.choice, labels)}
                    </Badge>
                    {day.source === "self" ? (
                      <Badge variant="info" size="sm">
                        {labels.bySelf}
                      </Badge>
                    ) : day.source === "coordinator" ? (
                      <Badge variant="accent" size="sm">
                        {labels.byCoordinator}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {day.contradictory ? (
                  <p className="mt-2 text-xs font-medium text-[color:var(--color-warn-ink)]">{labels.contradiction}</p>
                ) : null}

                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    aria-pressed={day.choice === "available"}
                    className={
                      day.choice === "available"
                        ? "border-transparent bg-[color:var(--color-ok)] text-white hover:bg-[color:var(--color-ok)]"
                        : undefined
                    }
                    onClick={() => submit(day.date, "available", null, null)}
                  >
                    {labels.available}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    aria-pressed={day.choice === "partial"}
                    className={
                      day.choice === "partial"
                        ? "border-transparent bg-[color:var(--color-warn)] text-white hover:bg-[color:var(--color-warn)]"
                        : undefined
                    }
                    onClick={() => setEditing(open ? null : day.date)}
                  >
                    {labels.partial}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    aria-pressed={day.choice === "unavailable"}
                    className={
                      day.choice === "unavailable"
                        ? "border-transparent bg-[color:var(--color-bad)] text-white hover:bg-[color:var(--color-bad)]"
                        : undefined
                    }
                    onClick={() => submit(day.date, "unavailable", null, null)}
                  >
                    {labels.unavailable}
                  </Button>
                </div>

                {open ? (
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
                ) : null}

                {day.choice !== "clear" && !busy ? (
                  <button
                    type="button"
                    onClick={() => submit(day.date, "clear", null, null)}
                    className="mt-2 text-xs text-[color:var(--color-muted)] underline underline-offset-2"
                  >
                    {labels.clear}
                  </button>
                ) : null}

                {error ? (
                  <p role="alert" className="mt-2 text-xs font-medium text-[color:var(--color-bad-ink)]">
                    {labels.errors[error]}
                  </p>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
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

  return (
    <div className="mt-3 rounded-lg bg-[color:var(--color-canvas)] p-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <SelectField
          id="partial-from"
          label={labels.from}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          options={startTimes.map((time) => ({ value: time, label: time }))}
          containerClassName="flex-1"
        />
        <SelectField
          id="partial-to"
          label={labels.to}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          // A real (non-hidden) option, not `placeholder` — the coordinator must be able to pick
          // "end of day" back after choosing an end time, and `SelectField`'s `placeholder` option
          // is `hidden`, which would take that choice off the list once something else was picked.
          options={[{ value: "", label: labels.endOfDay }, ...endTimes.map((time) => ({ value: time, label: time }))]}
          containerClassName="flex-1"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" loading={busy} onClick={() => onApply(from, to === "" ? null : to)}>
          {labels.apply}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
