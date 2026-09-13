"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";
import { translatorFor, DEFAULT_LOCALE, type TranslationKey } from "@/lib/i18n";
import type { ImportField } from "@/lib/import/types";
import type { RowReason } from "./types";

/**
 * Small pieces the wizard's steps share. `components/ui` is frozen, so these compose it rather than
 * extend it — the same shapes `app/campaigns/[id]/shifts/new/shift-series-form.tsx` already uses.
 */

export const t = translatorFor(DEFAULT_LOCALE);

/** Greek and English both have one/other; the key pair carries the sentence, not a suffix. */
export function tCount(count: number, one: TranslationKey, other: TranslationKey, params: Record<string, string | number> = {}) {
  return t(count === 1 ? one : other, { count, ...params });
}

export function fieldLabel(field: ImportField): string {
  return t(`shifts.import.field.${field}` as TranslationKey);
}

export function reasonLabel(reason: RowReason): string {
  return t(`shifts.import.reason.${reason}` as TranslationKey);
}

type Tone = "info" | "ok" | "warn" | "bad";

const TONE_CLASS: Record<Tone, string> = {
  info: "border-[color:var(--color-accent-line)] bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]",
  ok: "border-[color:var(--color-ok-line)] bg-[color:var(--color-ok-subtle)] text-[color:var(--color-ok-ink)]",
  warn: "border-[color:var(--color-warn-line)] bg-[color:var(--color-warn-subtle)] text-[color:var(--color-warn-ink)]",
  bad: "border-[color:var(--color-bad-line)] bg-[color:var(--color-bad-subtle)] text-[color:var(--color-bad-ink)]",
};

const TONE_ICON: Record<Tone, IconName> = { info: "spark", ok: "check", warn: "alert", bad: "alert" };

export function Banner({ tone, children, role }: { tone: Tone; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div
      role={role}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-5 ${TONE_CLASS[tone]}`}
    >
      <Icon name={TONE_ICON[tone]} size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function OptionChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <label
      className={
        "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-3.5 py-2 text-sm text-[color:var(--color-ink)] transition-colors duration-150 ease-[var(--ease-out-soft)] hover:border-[color:var(--color-line-strong)] hover:bg-[color:var(--color-surface-hover)] has-[:checked]:border-[color:var(--color-accent-line)] has-[:checked]:bg-[color:var(--color-accent-subtle)] has-[:checked]:text-[color:var(--color-accent-ink)] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:shadow-[var(--focus-ring)] " +
        (className ?? "")
      }
    >
      {children}
    </label>
  );
}

export const RADIO_CLASS = "size-4 shrink-0 accent-[color:var(--color-accent)] outline-none";

export function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold text-[color:var(--color-ink)]">{title}</h3>
      {description ? <p className="text-sm text-pretty text-[color:var(--color-muted)]">{description}</p> : null}
    </div>
  );
}

/** "2026-09-15" → "15/09/2026", the way the file and the coordinator write it. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
