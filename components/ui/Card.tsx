import type { ReactNode } from "react";
import { cn } from "./cn";

/** Added in P34. `card` is the default and the only one most screens need. */
export type CardElevation = "flat" | "card" | "raised";

export interface CardProps {
  /** Optional slot rendered above a divider, e.g. a title row. */
  header?: ReactNode;
  /** Optional slot rendered below a divider, e.g. actions. */
  footer?: ReactNode;
  /** Depth. Defaults to "card". Use "raised" for the one card a page is about. */
  elevation?: CardElevation;
  /**
   * Drop the body padding. For a card whose body is a full-bleed table or list
   * that brings its own padding — the alternative is every such screen passing
   * `className="p-0"` and fighting the base class.
   */
  flush?: boolean;
  /** Lifts on hover. Only for a card that is itself a link or a button. */
  interactive?: boolean;
  children: ReactNode;
  className?: string;
}

const ELEVATIONS: Record<CardElevation, string> = {
  flat: "shadow-none",
  card: "shadow-[var(--elevation-card)]",
  raised: "shadow-[var(--elevation-raised)]",
};

/**
 * Surface container matching the app's card/panel language.
 *
 * P42a: a card is **white paper on an ivory desk**. That is the whole idea, and
 * three things carry it — a 24px radius, a warm hairline that is barely a line,
 * and a shadow so diffuse it reads as lift rather than as a drop shadow. Darken
 * any one of them and the card goes back to being a box drawn around content.
 *
 * The header and footer bands lost their tint in P42a. A sunken strip inside a
 * white card was the old system's way of giving a titled card structure; on
 * ivory it reads as a second, dirtier surface, and the hairline divider alone
 * does the job.
 */
export function Card({
  header,
  footer,
  elevation = "card",
  flush = false,
  interactive = false,
  children,
  className,
}: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)]",
        ELEVATIONS[elevation],
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:border-[color:var(--color-line-strong)] hover:shadow-[var(--elevation-card-hover)]",
        className,
      )}
    >
      {header ? (
        <div className="border-b border-[color:var(--color-line)] px-5 py-4 sm:px-6">
          {header}
        </div>
      ) : null}
      <div className={flush ? undefined : "px-5 py-5 sm:px-6"}>{children}</div>
      {footer ? (
        <div className="border-t border-[color:var(--color-line)] px-5 py-4 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
