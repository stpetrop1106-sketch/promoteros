import type { ReactNode } from "react";
import { cn } from "./cn";

export type StatTileTone = "neutral" | "accent" | "ok" | "warn" | "bad";

/**
 * The pastel the icon chip is painted in. Added in P42a and **optional** — left
 * out, the chip takes the pastel that belongs to `tone`, which is what every
 * existing call site gets without being edited.
 *
 * Pass it only when a screen puts several tiles of the same `tone` in one strip
 * and wants them told apart by colour, which is exactly what the reference
 * dashboard does with its four cards.
 */
export type StatTileChip = "peach" | "mint" | "lilac" | "sand" | "rose";

/**
 * Which way the delta points. `flat` is the default and is simply muted — a
 * number that has not moved is not news and must not be coloured as if it were.
 */
export type StatTileDelta = "up" | "down" | "flat";

export interface StatTileProps {
  /** What the number counts, e.g. "Βάρδιες χωρίς κάλυψη". Always a `t()` key. */
  label: string;
  /** The number itself. A node, so a unit or a fraction can be styled inside. */
  value: ReactNode;
  /** Decorative glyph — pass `<Icon name="calendar" />`. */
  icon?: ReactNode;
  /** One line under the value, e.g. "σε 7 ημέρες". */
  hint?: string;
  /** Tints the icon chip. `neutral` by default. */
  tone?: StatTileTone;
  /**
   * The movement line under the number, e.g. "12.5% από τον προηγούμενο μήνα".
   * Added in P42a; optional, and a tile without one looks exactly as it did.
   *
   * The caller supplies the whole sentence from `t()` — this component adds
   * only the arrow and the colour, because it has no way to know what the
   * comparison period is called in Greek.
   */
  delta?: ReactNode;
  /**
   * Which direction the delta moved, and therefore its colour. Defaults to
   * `flat` (muted). **Direction is not sentiment**: a rising no-show count is
   * `up` and green is the wrong colour for it, so pass `deltaTone` for the
   * meaning, not for the arithmetic — see the note on the arrow below.
   */
  deltaTone?: StatTileDelta;
  /** The icon chip's pastel. Defaults to the one `tone` implies. */
  chip?: StatTileChip;
  /** Optional trailing slot, e.g. a link into the filtered list. */
  action?: ReactNode;
  className?: string;
}

/**
 * The pastels, by name.
 *
 * These chips are the only saturated colour on a coordinator screen. That is a
 * budget, not an accident: one small square of colour per card reads as a
 * considered system, and the same colour spread across a card's border, title
 * and value reads as a theme someone downloaded.
 */
const CHIPS: Record<StatTileChip, string> = {
  peach: "bg-[color:var(--color-chip-peach)] text-[color:var(--color-chip-peach-ink)]",
  mint: "bg-[color:var(--color-chip-mint)] text-[color:var(--color-chip-mint-ink)]",
  lilac: "bg-[color:var(--color-chip-lilac)] text-[color:var(--color-chip-lilac-ink)]",
  sand: "bg-[color:var(--color-chip-sand)] text-[color:var(--color-chip-sand-ink)]",
  rose: "bg-[color:var(--color-chip-rose)] text-[color:var(--color-chip-rose-ink)]",
};

/** What each tone means in pastel, when the caller has not chosen for itself. */
const TONE_CHIP: Record<StatTileTone, StatTileChip> = {
  neutral: "lilac",
  accent: "peach",
  ok: "mint",
  warn: "sand",
  bad: "rose",
};

const DELTA_TONES: Record<StatTileDelta, string> = {
  up: "text-[color:var(--color-ok-ink)]",
  down: "text-[color:var(--color-bad-ink)]",
  flat: "text-[color:var(--color-muted)]",
};

/**
 * The delta's arrow, drawn rather than typed.
 *
 * A "↑" from the text stream is whatever shape the fallback font has for it and
 * sits on its own baseline; at 11px next to Greek that is visibly a different
 * typeface. This is on the icon set's own grid. It is `aria-hidden` because the
 * caller's sentence already says which way the number went — the arrow repeats
 * it for the eye, never instead of it.
 */
function DeltaArrow({ direction }: { direction: StatTileDelta }) {
  if (direction === "flat") return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="mt-px shrink-0"
    >
      {direction === "up" ? (
        <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
      ) : (
        <path d="M12 5v14M5.5 12.5 12 19l6.5-6.5" />
      )}
    </svg>
  );
}

/**
 * One metric in the stat strip that sits under a page heading.
 *
 * The order is deliberate and the opposite of the obvious one: the **label
 * reads first, small and quiet**, then the number lands large underneath. A
 * coordinator scanning the strip is looking for the number that is wrong, and
 * that only works if all the numbers share a baseline and a size — so the
 * value is fixed at `text-3xl` and never grows with its content.
 *
 * P42a moved the icon chip from beside the label to the **top-right corner**
 * and took the tone off the value. Both come from the same observation: when
 * the chip sat in the text column it pushed the label and the number apart, and
 * a red number next to a red chip next to a red delta is three ways of saying
 * one thing. Now the column is label → number → delta, uninterrupted, and the
 * colour lives in exactly two places — the corner chip and the delta line.
 *
 * Purely presentational. Tone is the caller's judgement, not the tile's: a
 * value of 0 is good for "no-shows" and bad for "covered", and this component
 * has no way to know which.
 */
export function StatTile({
  label,
  value,
  icon,
  hint,
  tone = "neutral",
  delta,
  deltaTone = "flat",
  chip,
  action,
  className,
}: StatTileProps) {
  const chipClass = CHIPS[chip ?? TONE_CHIP[tone]];

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] p-5 shadow-[var(--elevation-card)] transition-shadow duration-200 sm:p-6",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Two lines, then clip — not one line with an ellipsis. "Βάρδιες χωρίς κάλυψη"
            is 20 characters and the English is 13; truncating to one line hides the half
            of the Greek label that says *which* shifts. `StatStrip` is a grid, so the
            tiles in a row stretch to the tallest, and the label box is held at exactly two
            lines (`min-h-8` = 2 × the 1rem `text-2xs` line height) so a one-line label
            and a two-line label next to it still put their numbers on the same baseline —
            which is the whole reason the strip is scannable.

            `break-words` is not decoration. A screen that puts six tiles in one strip gives each
            label about sixty pixels, and an unbreakable Greek uppercase word — ΒΑΡΔΙΕΣ, ΠΟΣΟΣΤΟ —
            is wider than that, so without it the clamp slices the word mid-letter and the label
            reads "ΒΑΡΔΙΕ". Breaking the word is ugly; losing its last letter silently is worse. */}
        <p className="line-clamp-2 min-h-8 flex-1 break-words text-2xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">
          {label}
        </p>
        {icon ? (
          <span
            aria-hidden="true"
            className={cn(
              "-mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
              chipClass,
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>

      {/* Always ink, whatever the tone. The number is the thing being read; the
          corner chip and the delta say how to feel about it. */}
      <p className="mt-2 text-3xl font-semibold tabular-nums leading-none tracking-tight text-[color:var(--color-ink)]">
        {value}
      </p>

      {delta ? (
        <p
          className={cn(
            "mt-2.5 flex items-start gap-1 text-xs font-medium",
            DELTA_TONES[deltaTone],
          )}
        >
          <DeltaArrow direction={deltaTone} />
          <span className="min-w-0 text-pretty">{delta}</span>
        </p>
      ) : null}

      {hint ? (
        <p className="mt-2 text-xs text-[color:var(--color-muted)]">{hint}</p>
      ) : null}

      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export interface StatStripProps {
  children: ReactNode;
  className?: string;
}

/**
 * The row the tiles live in. A plain auto-fit grid rather than fixed column
 * counts, so a page with three tiles and a page with five both look composed
 * and neither wraps to a single orphan on a laptop.
 */
export function StatStrip({ children, className }: StatStripProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
