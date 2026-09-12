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
 * The border is now a hairline rather than a frame: with a real shadow doing
 * the separating, a strong border reads as a box drawn around the content. The
 * two work together — soften one and the other has to carry more.
 *
 * Header and footer sit in a faintly sunken band, which is what gives a card
 * with a title row its sense of structure without adding a second border.
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
        <div className="border-b border-[color:var(--color-line)] bg-[color:var(--color-n-25)] px-5 py-3.5 sm:px-6">
          {header}
        </div>
      ) : null}
      <div className={flush ? undefined : "px-5 py-5 sm:px-6"}>{children}</div>
      {footer ? (
        <div className="border-t border-[color:var(--color-line)] bg-[color:var(--color-n-25)] px-5 py-3.5 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
