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
  /**
   * Accessible name for the scroll container, e.g. t("shifts.title"). The
   * container is focusable so a keyboard user can scroll a wide table sideways,
   * and a focus stop that announces nothing is worse than no name at all — so
   * the `region` role is only applied when there is something to call it.
   * Added in P34; every existing call site omits it and is unaffected.
   */
  label?: string;
  /**
   * How the table decides its own width. Added in P34; the default is what
   * every existing table already does.
   *
   * - `"intrinsic"` (default) — `min-w-max`: no cell ever wraps and the table
   *   scrolls sideways instead. Right for the dense, short-valued tables the
   *   product is mostly made of (date, store, status, score).
   * - `"fluid"` — `min-w-full`: the table fits the column and long cells wrap.
   *   Reach for it when a table carries a prose column (a note, an address, a
   *   decline reason), which under `"intrinsic"` drags the whole table several
   *   screens wide and buries every column after it.
   */
  layout?: "intrinsic" | "fluid";
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
  label,
  layout = "intrinsic",
  children,
  ...rest
}: TableProps) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={0}
      className={cn(
        "w-full overflow-x-auto focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]",
        // The edge shadows that say "there is more to the right". See the utility's comment in
        // `app/globals.css` — it is pure CSS and only paints on a side that can actually scroll.
        "scroll-shadow-x",
        !bare &&
          "rounded-2xl border border-[color:var(--color-line)] bg-[color:var(--color-surface)] shadow-[var(--elevation-card)]",
        wrapperClassName,
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-left text-sm",
          layout === "fluid" ? "min-w-full" : "min-w-max",
          className,
        )}
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
  // P42a: no fill. A tinted header band inside a white card was the old system's way of
  // separating the head from the body; on ivory it reads as a second, dirtier surface. A micro
  // uppercase label over a hairline is both quieter and more obviously a header.
  return (
    <thead
      className={cn(
        "border-b border-[color:var(--color-line)] text-2xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]",
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
      className={cn("whitespace-nowrap px-4 py-3.5 font-semibold sm:px-5", className)}
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
  // `tabular-nums` on every cell, not only the numeric ones. A table is read down a column, and
  // lining figures are what let the eye compare 12 against 120 without reading either — and it
  // costs nothing on a cell full of Greek.
  return (
    <td
      className={cn(
        "px-4 py-4 align-middle text-sm tabular-nums text-[color:var(--color-ink-soft)] sm:px-5",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  );
}
