import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "./cn";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Extra classes for the scroll wrapper, not the <table> itself. */
  wrapperClassName?: string;
}

/**
 * Semantic <table> wrapped in its own horizontal-scroll container, so a
 * wide table scrolls inside itself instead of pushing the page wide on
 * small screens.
 */
export function Table({ className, wrapperClassName, children, ...rest }: TableProps) {
  return (
    <div
      role="region"
      tabIndex={0}
      className={cn(
        "w-full overflow-x-auto rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-surface)]",
        wrapperClassName,
      )}
    >
      <table className={cn("w-full min-w-max border-collapse text-left text-sm", className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "bg-[color:var(--color-canvas)] text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]",
        className,
      )}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "divide-y divide-[color:var(--color-line)] [&>tr:nth-child(even)]:bg-[color:var(--color-canvas)]",
        className,
      )}
      {...rest}
    >
      {children}
    </tbody>
  );
}

export function TableRow({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn(className)} {...rest}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  className,
  children,
  scope = "col",
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th scope={scope} className={cn("px-4 py-3 font-semibold", className)} {...rest}>
      {children}
    </th>
  );
}

export function TableCell({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("px-4 py-3 align-middle text-[color:var(--color-ink)]", className)} {...rest}>
      {children}
    </td>
  );
}
