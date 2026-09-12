import type { ReactNode } from "react";
import { cn } from "./cn";

/** Added in P34. `md` matches every existing call site. */
export type PageHeaderSize = "md" | "lg";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-hand slot, e.g. primary actions. Wraps below the title on narrow screens. */
  actions?: ReactNode;
  /**
   * A small line above the title — the section the screen belongs to, or a
   * breadcrumb back. Added in P34.
   */
  eyebrow?: ReactNode;
  /** Decorative glyph in a tinted chip beside the title. Added in P34. */
  icon?: ReactNode;
  /**
   * "lg" is the greeting treatment for a screen that is somebody's home — the
   * dashboard. Everything else stays "md". Added in P34.
   */
  size?: PageHeaderSize;
  /** Content pinned under the header, e.g. a `<StatStrip>`. Added in P34. */
  children?: ReactNode;
  className?: string;
}

const TITLE_SIZES: Record<PageHeaderSize, string> = {
  md: "text-2xl",
  lg: "text-3xl sm:text-4xl",
};

/**
 * Page-level title row used at the top of every coordinator screen.
 *
 * `text-wrap: balance` on the heading and `text-pretty` on the subtitle are
 * doing real work here: Greek headings are long, and a two-line title that
 * breaks 90/10 is the difference between a page that looks typeset and one
 * that looks like it wrapped by accident.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
  icon,
  size = "md",
  children,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* Actions centre against a bare title and top-align against a title that
          carries a subtitle — otherwise a lone button floats half a line low. */}
      <div
        className={cn(
          "flex flex-col gap-4 sm:flex-row sm:justify-between sm:gap-6",
          subtitle || eyebrow ? "sm:items-start" : "sm:items-center",
        )}
      >
        <div className="flex min-w-0 items-start gap-3.5">
          {icon ? (
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-accent-subtle)] text-[color:var(--color-accent-ink)]"
            >
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
                {eyebrow}
              </div>
            ) : null}
            <h1
              className={cn(
                "text-balance font-semibold tracking-tight text-[color:var(--color-ink)]",
                TITLE_SIZES[size],
              )}
            >
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-6 text-[color:var(--color-muted)]">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
