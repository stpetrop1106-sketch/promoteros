import type { ReactNode } from "react";
import { cn } from "./cn";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-hand slot, e.g. primary actions. Wraps below the title on narrow screens. */
  actions?: ReactNode;
  className?: string;
}

/** Page-level title row used at the top of every coordinator screen. */
export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-ink)]">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-[color:var(--color-muted)]">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
