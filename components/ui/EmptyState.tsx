import type { ReactNode } from "react";
import { cn } from "./cn";

export interface EmptyStateProps {
  /** Decorative icon/glyph; hidden from assistive tech. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/** Placeholder shown in place of a list/table/board with no rows yet. */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-[color:var(--color-line)] bg-[color:var(--color-surface)] px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="flex size-12 items-center justify-center rounded-full bg-[color:var(--color-canvas)] text-[color:var(--color-muted)]"
        >
          {icon}
        </div>
      ) : null}
      <div className="max-w-sm">
        <p className="text-base font-semibold text-[color:var(--color-ink)]">{title}</p>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-[color:var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
