import type { ReactNode } from "react";
import { cn } from "./cn";

export interface CardProps {
  /** Optional slot rendered above a divider, e.g. a title row. */
  header?: ReactNode;
  /** Optional slot rendered below a divider, e.g. actions. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Surface container matching the app's card/panel language. */
export function Card({ header, footer, children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-sm",
        className,
      )}
    >
      {header ? (
        <div className="border-b border-[color:var(--color-line)] px-4 py-3 sm:px-5">
          {header}
        </div>
      ) : null}
      <div className="px-4 py-4 sm:px-5">{children}</div>
      {footer ? (
        <div className="border-t border-[color:var(--color-line)] px-4 py-3 sm:px-5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
