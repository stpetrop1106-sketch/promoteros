import type { ReactNode } from "react";
import { cn } from "./cn";

export interface SectionHeadingProps {
  /** The heading itself. Always a `t()` string from the screen. */
  title: string;
  /**
   * The heading level. Defaults to 2 — a page section under the `PageHeader`'s `<h1>`. Pass 3
   * for a heading nested inside a section that already has one.
   */
  level?: 2 | 3;
  /**
   * A count or a short status beside the title, e.g. "12" or "4 από 6 καλυμμένες". Rendered
   * quiet and small, so the title still leads.
   */
  meta?: ReactNode;
  /** One line under the title. Use it to say what the section is for, not to repeat the title. */
  description?: string;
  /** Right-hand slot. Wraps under the title on a phone rather than squeezing it. */
  actions?: ReactNode;
  className?: string;
}

/* P42a: level 2 dropped to the micro step. The reference's section labels are
   11px uppercase with open tracking — small enough that the label reads as a
   tab on a filing divider rather than as a competing headline, which is exactly
   the relationship a section label should have to its own content. */
const LEVEL_CLASS = {
  2: "text-2xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]",
  3: "text-sm font-semibold text-[color:var(--color-ink)]",
} as const;

/**
 * The heading above a section, and inside a `Card`'s `header`.
 *
 * Added in P35 because there were four of these. The same `<h2>` was written as `text-base
 * font-medium` on the dashboard, `text-base font-semibold` on the campaign detail, `text-sm
 * font-semibold` on the promoter profile and plain `text-sm` in settings — four weights and two
 * sizes for one idea, which is the loudest possible "nobody chose this" signal on a screen that
 * stacks six of them down the page.
 *
 * Level 2 is deliberately *quieter* than the content it introduces: small, uppercase and muted,
 * so the section label reads as a tab on a filing divider rather than as a competing headline.
 * A screen has one loud thing — the `PageHeader` — and section labels are not it.
 */
export function SectionHeading({
  title,
  level = 2,
  meta,
  description,
  actions,
  className,
}: SectionHeadingProps) {
  const Tag = level === 3 ? "h3" : "h2";

  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <Tag className={LEVEL_CLASS[level]}>{title}</Tag>
          {meta !== undefined && meta !== null ? (
            <span className="text-xs font-medium tabular-nums text-[color:var(--color-muted-soft)]">
              {meta}
            </span>
          ) : null}
        </div>
        {description ? (
          <p className="mt-1 max-w-prose text-pretty text-xs leading-5 text-[color:var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface SectionProps extends Omit<SectionHeadingProps, "className"> {
  children: ReactNode;
  className?: string;
}

/**
 * A labelled block of a page: the heading, then the content, at the one gap the system uses
 * between a label and the thing it labels.
 *
 * The value is not the markup, it is that the gap is no longer a per-screen decision. Before
 * this, the same heading-to-content distance was written `mt-3` on the dashboard, `mt-4` on the
 * campaign detail and `mt-6` on the promoter profile, and inconsistent gaps are the single
 * loudest amateur tell on an otherwise tidy page.
 */
export function Section({ children, className, ...heading }: SectionProps) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <SectionHeading {...heading} />
      {children}
    </section>
  );
}

export interface DetailProps {
  /** What the value is. Always a `t()` string. */
  label: string;
  /** The value. A node, so a `Badge` or a `ScoreBar` can sit in the slot. */
  children: ReactNode;
  /** Let the value take the full width of the grid — for an address or a free-text note. */
  wide?: boolean;
}

/** One label/value pair inside a `DetailList`. */
export function Detail({ label, children, wide = false }: DetailProps) {
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <dt className="text-2xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[color:var(--color-ink-soft)]">{children}</dd>
    </div>
  );
}

export interface DetailListProps {
  children: ReactNode;
  /** Columns at `sm` and up. One column below that, always. Defaults to 2. */
  columns?: 1 | 2 | 3;
  className?: string;
}

const COLUMNS = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
} as const;

/**
 * The label-above-value grid a detail card is made of.
 *
 * Label above rather than label-beside-value on a justified row: the justified version was used
 * on the promoter profile and it breaks badly in Greek, where a long label and a long value push
 * apart until the pair no longer reads as a pair. Stacked, the label is a caption on its value
 * and the alignment holds at any width.
 */
export function DetailList({ children, columns = 2, className }: DetailListProps) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-4", COLUMNS[columns], className)}>
      {children}
    </dl>
  );
}
