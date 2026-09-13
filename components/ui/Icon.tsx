import type { SVGProps } from "react";
import { cn } from "./cn";

/**
 * The icon set, drawn inline.
 *
 * We deliberately carry no icon dependency: an icon library is ~40kB for the
 * dozen glyphs this product actually uses, and it drags in its own React
 * version constraints. Every path below is a 24×24 stroke glyph on a shared
 * grid — 1.75 stroke, round caps, round joins — so mixing two of them in a row
 * never looks like two different sets.
 *
 * Rules for adding one:
 *  - 24×24 viewBox, `stroke="currentColor"`, `fill="none"`, no hard-coded size
 *  - no colour inside the path; tone comes from the surrounding text colour
 *  - keep the visual weight of the existing glyphs, not the source SVG's
 */
const PATHS = {
  /* Navigation */
  home: "M3.2 10.6 12 3.8l8.8 6.8M5.6 9v10.2h12.8V9M9.8 19.2v-5.4h4.4v5.4",
  calendar:
    "M4 6.8A1.8 1.8 0 0 1 5.8 5h12.4A1.8 1.8 0 0 1 20 6.8v12.4A1.8 1.8 0 0 1 18.2 21H5.8A1.8 1.8 0 0 1 4 19.2zM4 9.6h16M8.4 3v4M15.6 3v4",
  users:
    "M15.4 20v-1.7a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 18.3V20M12.1 7.6a3.3 3.3 0 1 1-6.6 0 3.3 3.3 0 0 1 6.6 0M21 20v-1.7a3.6 3.6 0 0 0-2.7-3.5M15.6 4.3a3.6 3.6 0 0 1 0 6.8",
  megaphone:
    "M4 10.4v3.2a1.8 1.8 0 0 0 1.8 1.8h1.4l5.9 3.9a1 1 0 0 0 1.55-.83V5.56a1 1 0 0 0-1.55-.83L7.2 8.6H5.8A1.8 1.8 0 0 0 4 10.4M17.6 9.4a3.4 3.4 0 0 1 0 5.2M7.4 15.4l.9 4.2a1.2 1.2 0 0 0 1.17.95h.63",
  sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 4.6v4.8M9 14.6v4.8",

  /* Structure and motion */
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  chevronRight: "M9.5 5.5 16 12l-6.5 6.5",
  chevronDown: "M5.5 9.5 12 16l6.5-6.5",
  chevronLeft: "M14.5 5.5 8 12l6.5 6.5",
  arrowRight: "M4 12h15M13 6l6 6-6 6",
  arrowUpRight: "M7.5 16.5 16.5 7.5M9 7.5h7.5V15",
  plus: "M12 5v14M5 12h14",
  search: "M11 18.2a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4M20.5 20.5l-4.4-4.4",
  filter: "M4 6h16l-6.3 7.4v5.3l-3.4 1.8v-7.1z",

  /* Meaning */
  check: "M5 12.8 9.6 17.4 19 7.4",
  alert: "M12 8.4v4.4M12 16.6h.01M10.3 4.1 2.9 17a2 2 0 0 0 1.73 3h14.74a2 2 0 0 0 1.73-3L13.7 4.1a2 2 0 0 0-3.4 0",
  clock: "M12 20.2a8.2 8.2 0 1 0 0-16.4 8.2 8.2 0 0 0 0 16.4M12 7.4V12l3 1.8",
  mapPin:
    "M20 10.4c0 5.2-8 11-8 11s-8-5.8-8-11a8 8 0 1 1 16 0M14.6 10.2a2.6 2.6 0 1 1-5.2 0 2.6 2.6 0 0 1 5.2 0",
  spark: "M12 3.2 13.9 9 19.8 10.9 13.9 12.8 12 18.6 10.1 12.8 4.2 10.9 10.1 9zM18.6 16.4l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z",
  trendUp: "M3.5 16.8 9.4 10.9l3.6 3.6 7-7M15.4 4.5H20.5V9.6",
  building:
    "M4 20.4h16M5.6 20.4V5.4A1.4 1.4 0 0 1 7 4h6.6A1.4 1.4 0 0 1 15 5.4v15M15 10.2h2.6a1.4 1.4 0 0 1 1.4 1.4v8.8M8.8 8h2.6M8.8 12h2.6M8.8 16h2.6",
  logout: "M9.6 20.4H5.8A1.8 1.8 0 0 1 4 18.6V5.4a1.8 1.8 0 0 1 1.8-1.8h3.8M15.4 16.4 20 12l-4.6-4.4M20 12H9.4",
  copy: "M9 9.8A1.8 1.8 0 0 1 10.8 8h7.4A1.8 1.8 0 0 1 20 9.8v7.4a1.8 1.8 0 0 1-1.8 1.8h-7.4A1.8 1.8 0 0 1 9 17.2zM15 8V5.8A1.8 1.8 0 0 0 13.2 4H5.8A1.8 1.8 0 0 0 4 5.8v7.4A1.8 1.8 0 0 0 5.8 15H9",
  /** A speech bubble — used for "open in WhatsApp" without borrowing a trademarked logo. */
  message:
    "M20.4 11.6a8.2 8.2 0 0 1-12 7.3L3.6 20.4l1.5-4.6a8.2 8.2 0 1 1 15.3-4.2",
  inbox:
    "M4 13.6 6.6 5.2A1.8 1.8 0 0 1 8.3 4h7.4a1.8 1.8 0 0 1 1.7 1.2L20 13.6M4 13.6v4.6A1.8 1.8 0 0 0 5.8 20h12.4a1.8 1.8 0 0 0 1.8-1.8v-4.6M4 13.6h4.4l1.2 2.2h4.8l1.2-2.2H20",
} as const;

export type IconName = keyof typeof PATHS;

/** Every icon name, for a picker or a test that walks the set. */
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "children"> {
  name: IconName;
  /** Edge length in pixels. Defaults to 20 — the kit's inline size. */
  size?: number;
  /** Stroke weight. Defaults to 1.75, the grid the set is drawn on. */
  strokeWidth?: number;
  /**
   * An accessible name. Omit it — the default — and the icon is decorative and
   * hidden from assistive tech, which is correct whenever a visible label sits
   * next to it. Only pass it when the icon is the *only* thing carrying the
   * meaning.
   */
  title?: string;
}

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  title,
  className,
  ...rest
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      className={cn("shrink-0", className)}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name]} />
    </svg>
  );
}
