import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  /** Decorative icon/glyph; hidden from assistive tech. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** A second, quieter action beside the primary one. Added in P34. */
  secondaryAction?: ReactNode;
  /** Drop the dashed frame, for an empty state already inside a Card. Added in P34. */
  bare?: boolean;
  className?: string;
}

/**
 * Placeholder shown in place of a list/table/board with no rows yet.
 *
 * The dashed border is deliberate and stays: it is the one place in the system
 * where a dashed edge is right, because it says "this container is real, it is
 * just not filled yet" — which is exactly the state being communicated. A solid
 * card here would read as content.
 *
 * The icon chip stays a `<div>` carrying a `ring`, and that is load-bearing:
 * `app/dashboard/page.tsx` recolours it through a `[&>div:first-child]:…`
 * override for its "nothing is wrong" state, and that screen belongs to another
 * lane. The element and its ring are part of this component's contract as
 * surely as its props are.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  bare = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 px-6 py-16 text-center",
        !bare &&
          "rounded-2xl border border-dashed border-[color:var(--color-line-strong)] bg-[color:var(--color-surface)]/70",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-14 items-center justify-center rounded-2xl bg-[color:var(--color-chip-sand)] text-[color:var(--color-chip-sand-ink)] ring-1 ring-inset ring-[color:var(--color-line)]"
        >
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <p className="text-balance text-base font-semibold text-[color:var(--color-ink)]">
          {title}
        </p>
        {description ? (
          <p className="mt-1.5 text-pretty text-sm leading-6 text-[color:var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action || secondaryAction ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
