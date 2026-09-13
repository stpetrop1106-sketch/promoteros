"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Icon, SelectField } from "@/components/ui";
import type { StoreMatch } from "@/lib/import/types";
import { previewStoreLocation } from "./actions";
import { rankStoresBySimilarity } from "./plan";
import type { ImportStoreOption } from "./types";
import { Banner, OptionChip, RADIO_CLASS, StepHeading, t, tCount } from "./wizard-ui";

export type StoreDecision =
  | { action: "undecided" }
  | { action: "existing"; storeId: string }
  | { action: "create"; location: "pending" | "failed" | { formattedAddress: string; confidence: "high" | "medium" | "low" } }
  | { action: "skip" };

export function defaultDecision(match: StoreMatch): StoreDecision {
  // `exact` is accepted, `likely` pre-selected (and shown open); `none` is never guessed.
  if (match.match && match.confidence !== "none") return { action: "existing", storeId: match.match.storeId };
  return { action: "undecided" };
}

/** A decision the commit can use. A store still being located, or that could not be, is not one. */
export function isSettled(decision: StoreDecision): boolean {
  if (decision.action === "undecided") return false;
  if (decision.action === "create") return typeof decision.location === "object";
  return true;
}

export function decisionProblem(matches: StoreMatch[], decisionOf: (m: StoreMatch) => StoreDecision): string | null {
  let undecided = 0;
  let locating = 0;
  const unplaceable: string[] = [];
  for (const match of matches) {
    const d = decisionOf(match);
    if (d.action === "undecided") undecided++;
    else if (d.action === "create" && d.location === "pending") locating++;
    else if (d.action === "create" && d.location === "failed") unplaceable.push(match.name);
  }
  if (unplaceable.length > 0) return t("shifts.import.stores.problem.unplaceable", { names: unplaceable.join(", ") });
  if (undecided > 0) return tCount(undecided, "shifts.import.stores.problem.undecided_one", "shifts.import.stores.problem.undecided_other");
  if (locating > 0) return t("shifts.import.stores.problem.locating");
  return null;
}

const ORDER: Record<StoreMatch["confidence"], number> = { none: 0, likely: 1, exact: 2 };

export function StoresStep({
  matches,
  stores,
  decisionOf,
  onDecide,
}: {
  matches: StoreMatch[];
  stores: ImportStoreOption[];
  decisionOf: (m: StoreMatch) => StoreDecision;
  onDecide: (key: string, update: (current: StoreDecision | undefined) => StoreDecision) => void;
}) {
  const sorted = useMemo(
    () => [...matches].sort((a, b) => ORDER[a.confidence] - ORDER[b.confidence] || b.rowCount - a.rowCount),
    [matches],
  );
  const needDecision = matches.filter((m) => decisionOf(m).action === "undecided").length;

  if (matches.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <StepHeading title={t("shifts.import.stores.title")} />
        <Banner tone="warn">{t("shifts.import.stores.none")}</Banner>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <StepHeading
        title={t("shifts.import.stores.title")}
        description={
          tCount(matches.length, "shifts.import.stores.found_one", "shifts.import.stores.found_other") +
          (needDecision > 0 ? ` ${tCount(needDecision, "shifts.import.stores.need_one", "shifts.import.stores.need_other")}` : "")
        }
      />
      <ul className="flex flex-col gap-3">
        {sorted.map((match) => (
          <StoreCard
            key={match.key}
            match={match}
            stores={stores}
            decision={decisionOf(match)}
            onDecide={(update) => onDecide(match.key, update)}
          />
        ))}
      </ul>
    </div>
  );
}

function StoreCard({
  match,
  stores,
  decision,
  onDecide,
}: {
  match: StoreMatch;
  stores: ImportStoreOption[];
  decision: StoreDecision;
  onDecide: (update: (current: StoreDecision | undefined) => StoreDecision) => void;
}) {
  const [expanded, setExpanded] = useState(match.confidence !== "exact");
  const ranked = useMemo(() => rankStoresBySimilarity(match.name, stores), [match.name, stores]);
  const chosenStore = decision.action === "existing" ? stores.find((s) => s.id === decision.storeId) : undefined;
  const radioName = `import-store-${match.key}`;
  const where = [match.address, match.city].filter(Boolean).join(" · ");

  const locate = () => {
    onDecide(() => ({ action: "create", location: "pending" }));
    previewStoreLocation({ name: match.name, address: match.address, city: match.city })
      .then((result) => {
        const location = result.ok ? { formattedAddress: result.formattedAddress, confidence: result.confidence } : ("failed" as const);
        // Only if the coordinator is still on "create": a late answer never overrides a newer choice.
        onDecide((current) => (current?.action === "create" && current.location === "pending" ? { action: "create", location } : current ?? { action: "undecided" }));
      })
      .catch(() => {
        onDecide((current) =>
          current?.action === "create" && current.location === "pending" ? { action: "create", location: "failed" } : current ?? { action: "undecided" },
        );
      });
  };

  const badge =
    decision.action === "undecided" ? (
      <Badge variant="bad" size="sm" dot>
        {t("shifts.import.stores.badge.undecided")}
      </Badge>
    ) : match.confidence === "exact" && decision.action === "existing" && decision.storeId === match.match?.storeId ? (
      <Badge variant="ok" size="sm" dot>
        {t("shifts.import.stores.badge.exact")}
      </Badge>
    ) : match.confidence === "likely" && decision.action === "existing" && decision.storeId === match.match?.storeId ? (
      <Badge variant="warn" size="sm" dot>
        {t("shifts.import.stores.badge.likely")}
      </Badge>
    ) : (
      <Badge variant="info" size="sm">
        {t("shifts.import.stores.badge.chosen")}
      </Badge>
    );

  return (
    <li
      className={
        "rounded-xl border bg-[color:var(--color-surface)] px-4 py-4 " +
        (decision.action === "undecided" ? "border-[color:var(--color-bad-line)]" : "border-[color:var(--color-line)]")
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-[color:var(--color-ink)]">{match.name}</p>
          <p className="mt-0.5 text-xs text-[color:var(--color-muted)]">
            {[where, tCount(match.rowCount, "shifts.import.stores.rows_one", "shifts.import.stores.rows_other")].filter(Boolean).join(" · ")}
          </p>
        </div>
        {badge}
      </div>

      {!expanded ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-[color:var(--color-ink-soft)]">
            <Icon name="arrowRight" size={14} className="shrink-0 text-[color:var(--color-muted)]" />
            <span className="break-words">{chosenStore ? storeLabel(chosenStore) : "—"}</span>
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(true)}>
            {t("shifts.import.stores.change")}
          </Button>
        </div>
      ) : (
        <fieldset className="mt-3 flex flex-col gap-2">
          <legend className="sr-only">{t("shifts.import.stores.choice_legend", { name: match.name })}</legend>

          {match.confidence === "likely" && match.match ? (
            <p className="text-xs text-[color:var(--color-warn-ink)]">
              {t("shifts.import.stores.likely_hint", { store: match.match.storeName })}
            </p>
          ) : null}

          <OptionChip className="flex-wrap">
            <input
              type="radio"
              name={radioName}
              checked={decision.action === "existing"}
              disabled={stores.length === 0}
              onChange={() => onDecide(() => ({ action: "existing", storeId: chosenStore?.id ?? ranked[0]?.id ?? "" }))}
              className={RADIO_CLASS}
            />
            <span>{t("shifts.import.stores.use_existing")}</span>
          </OptionChip>
          {decision.action === "existing" ? (
            <SelectField
              id={`${radioName}-select`}
              label={t("shifts.import.stores.existing_label")}
              value={decision.storeId}
              onChange={(event) => onDecide(() => ({ action: "existing", storeId: event.target.value }))}
              options={ranked.map((s) => ({ value: s.id, label: storeLabel(s) }))}
              containerClassName="pl-0 sm:pl-7"
            />
          ) : null}

          <OptionChip>
            <input
              type="radio"
              name={radioName}
              checked={decision.action === "create"}
              onChange={locate}
              className={RADIO_CLASS}
            />
            <span>{t("shifts.import.stores.create")}</span>
          </OptionChip>
          {decision.action === "create" ? (
            <div className="sm:pl-7">
              {decision.location === "pending" ? (
                <p className="text-sm text-[color:var(--color-muted)]" role="status">
                  {t("shifts.import.stores.locating")}
                </p>
              ) : decision.location === "failed" ? (
                <Banner tone="bad" role="alert">
                  {t("shifts.import.stores.unplaceable")}
                </Banner>
              ) : (
                <Banner tone={decision.location.confidence === "low" ? "warn" : "info"} role="status">
                  <p>{t("shifts.import.stores.located", { address: decision.location.formattedAddress })}</p>
                  {decision.location.confidence === "low" ? <p className="mt-1">{t("shifts.import.stores.located_low")}</p> : null}
                </Banner>
              )}
            </div>
          ) : null}

          <OptionChip>
            <input
              type="radio"
              name={radioName}
              checked={decision.action === "skip"}
              onChange={() => onDecide(() => ({ action: "skip" }))}
              className={RADIO_CLASS}
            />
            <span>{tCount(match.rowCount, "shifts.import.stores.skip_one", "shifts.import.stores.skip_other")}</span>
          </OptionChip>
        </fieldset>
      )}
    </li>
  );
}

function storeLabel(store: ImportStoreOption): string {
  return store.address ? `${store.name} — ${store.address}` : store.name;
}
