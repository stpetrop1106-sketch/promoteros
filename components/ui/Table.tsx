import type {
  HTMLAttributes,
  ReactNode,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "./cn";

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Extra classes for the scroll wrapper, not the <table> itself. */
  wrapperClassName?: string;
  /**
   * Drop the wrapper's own border, radius and background. For a table that
   * already sits inside a `<Card flush>` and would otherwise show two frames.
   * Added in P34.
   */
  bare?: boolean;
}

/**
 * Semantic <table> wrapped in its own horizontal-scroll container, so a
 * wide table scrolls inside itself instead of pushing the page wide on
 * small screens.
 *
 * P34 removed the zebra striping. Alternating row fills are a workaround for
 * rows that are too tight to track by eye; the fix is the row height and the
 * divider, and once those are right the stripes only add noise — and they
 * fight the soft status tints in the state column, which is the one thing on
 * the row that is *supposed* to have a background.
 */
export function Table({
  className,
  wrapperClassName,
  bare = false,
  children,
  ...rest
}: TableProps) {
  return (
    <div
      role="region"
      tabIndex={0}
      className={cn(
        "w-full overflow-x-auto focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        !bare &&
          "rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-[var(--elevation-card)]",
        wrapperClassName,
      )}
    >
      <table
        className={cn("w-full min-w-max border-collapse text-left text-sm", className)}
        {...rest}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHead({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn(
        "border-b border-[color:var(--color-line)] bg-[color:var(--color-n-25)] text-2xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]",
        className,
      )}
      {...rest}
    >
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody
      className={cn(
        "divide-y divide-[color:var(--color-line)] [&>tr]:transition-colors [&>tr]:duration-100 [&>tr:hover]:bg-[color:var(--color-surface-hover)]",
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

export interface TableHeaderCellProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /**
   * Decorative glyph before the label. The reference dashboard puts an icon on
   * every column header and it is the cheapest way to make a header row read
   * as a header rather than as a bold first row. Added in P34.
   */
  icon?: ReactNode;
}

export function TableHeaderCell({
  className,
  children,
  icon,
  scope = "col",
  ...rest
}: TableHeaderCellProps) {
  return (
    <th
      scope={scope}
      className={cn("whitespace-nowrap px-4 py-3 font-semibold", className)}
      {...rest}
    >
      {icon ? (
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="text-[color:var(--color-muted-soft)]">
            {icon}
          </span>
          {children}
        </span>
      ) : (
        children
      )}
    </th>
  );
}

export function TableCell({ className, children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn("px-4 py-3.5 align-middle text-[color:var(--color-ink-soft)]", className)}
      {...rest}
    >
      {children}
    </td>
  );
}
