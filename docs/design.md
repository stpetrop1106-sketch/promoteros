# The PromoterOS design system

Owned by Lane D (`docs/status/P34.md`). Everything visual lives in three places:

| | |
|---|---|
| `app/globals.css` | tokens — colour, type, radius, elevation, shell geometry |
| `components/ui/**` | the kit — the components every screen composes |
| `components/coordinator-nav.tsx`, `app/layout.tsx` | the shell around the kit |

Nothing else styles anything. A screen that needs a colour, a size or a shadow reaches for a
token or a component; it does not invent one.

---

## The one rule that outranks the rest

**A component's look belongs to this system. A component's API belongs to the 45 screens that
call it.**

You may restyle anything in `components/ui/`. You may not rename an export, rename a prop, remove
a variant value, or change a default. New props are optional with a default that reproduces the
current behaviour. That is why `Table` grew `label` and `layout`, and `Button` grew `subtle` and
`lg`, instead of anything changing shape.

---

## Colour

The palette is one hue family for neutrals, one brand pair, and three status triples. There are no
other colours. If a screen needs "a different blue", it needs a different component.

### Neutrals — `--color-n-0` … `--color-n-950`

A single blue-grey ramp at roughly 222°, so neutrals sit *under* the brand blue rather than
fighting it. Use the ramp directly only when the semantic name below does not exist.

### Semantic surfaces and text

| Token | Use it for |
|---|---|
| `--color-canvas` | the page behind everything |
| `--color-canvas-sunken` | a well *inside* a surface: table head, input rest, progress track |
| `--color-surface` | cards, sheets, menus, the sidebar |
| `--color-surface-hover` | a row or menu item under the pointer |
| `--color-ink` | headings and primary text |
| `--color-ink-soft` | body copy inside a card, table cell values |
| `--color-muted` | labels, captions, hints — anything that explains rather than states |
| `--color-muted-soft` | placeholders, resting icons, disabled text |
| `--color-line` | the default hairline; borders and dividers |
| `--color-line-strong` | a border that has to be noticed — a control's edge, a dashed frame |

The hierarchy is real: four text tones and two line weights. If everything on a screen is
`--color-ink` on `--color-surface` with a `--color-line` border, the screen has no hierarchy and
will read as a prototype no matter how good the spacing is.

### Brand

`--color-accent` (#1646B8) is the mark's blue and the product's one loud colour. It means
*"this is the action"* or *"this is where you are"* — a primary button, an active nav item, a
focus ring, the total match score. Spend it once or twice per screen.

`--color-action` (#2ED3C6) is the mark's teal and is a **counterpoint, not a second accent**. It
appears in the `ScoreBar` gradient and the `accent` Badge and essentially nowhere else. A teal
button does not exist.

Each has a `-subtle` tint (for a fill behind text), a `-line` (for a hairline on that tint) and an
`-ink` (a foreground dark enough to clear AA *on that tint*). Never put `-ink` text on white and
never put white text on `-subtle`.

### Status — `ok` / `warn` / `bad`

Same triple shape: `--color-ok`, `--color-ok-subtle`, `--color-ok-line`, `--color-ok-ink`.

- the saturated base is for **icons, dots and solid fills only**
- the `subtle`/`ink` pair is for **everything with text in it** — pills, banners, tinted rows

A shift list is twenty status pills. At full saturation that is a page of traffic lights and the
coordinator cannot find the one row that is wrong, which is the only reason the column exists.

`--color-neutral-subtle` / `-line` / `-ink` completes the set so a "nothing has happened yet"
state has the same shape as the three that mean something.

**Colour is never the only carrier of meaning.** Every status pill has a word in it. `Badge`'s
`dot` prop adds a glyph *alongside* the word, never instead of it.

---

## Type

Inter, loaded by `next/font` in `app/layout.tsx` with the `greek` subset requested explicitly —
`next/font` fails the **build** when a family lacks a requested subset, so Greek coverage is
verified by CI rather than by eye. Do not change the family without keeping that guarantee.

Every step carries its own line-height and tracking. Tracking tightens as size grows; the two
smallest steps carry positive tracking so Greek uppercase labels stay legible.

| Step | Size | Where |
|---|---|---|
| `text-2xs` | 11px | table headers, section labels, the smallest pill |
| `text-xs` | 12px | hints, captions, metadata under a value |
| `text-sm` | 14px | **the app's body size.** Table cells, form controls, buttons |
| `text-base` | 16px | prose a promoter reads on a phone; an `EmptyState` title |
| `text-lg` | 18px | a card title that has to lead |
| `text-xl` – `text-2xl` | 21–24px | `PageHeader` at `md`, section headings |
| `text-3xl` | 30px | `StatTile` values, `PageHeader` at `lg` |
| `text-4xl`+ | 36px+ | the landing page only |

Weights are 400, 500 (a label), 600 (a heading, a button, a value). There is no 700 — at Inter's
optical sizes bold reads as shouting next to 600.

Greek runs 30–40% longer than English. **Design for the Greek string.** Anywhere a label can be
cut, cutting it loses the half that carries the meaning: `Βάρδιες χωρίς κάλυψη` truncated to one
line is `Βάρδιες…`. Prefer wrapping (`text-pretty`, `line-clamp-2`, a `min-h` that reserves the
second line) over `truncate`. `truncate` is for a value the user already knows — a name, a store.

---

## Elevation

Reach for the semantic name, never a raw shadow utility, so a card and a popover cannot drift
apart across parcels.

| Token | Height | What sits there |
|---|---|---|
| `--elevation-flat` | 0 | a panel inside another panel; a section divider does the work |
| `--elevation-card` | 1 | the default. `Card`, `StatTile`, `Table`'s frame |
| `--elevation-card-hover` | 2 | a `Card interactive` under the pointer |
| `--elevation-raised` | 3 | the one card a page is actually about |
| `--elevation-overlay` | 4 | the mobile nav drawer, a menu, anything over content |

Every shadow is layered — a tight contact shadow plus a wide soft ambient one — and tinted with
the ink hue rather than black, which is what stops a shadow reading as grey smudge on a blue-grey
canvas.

**A border and a shadow share the work.** The border is a hairline (`--color-line`) precisely
because the shadow is doing the separating; darken one and you must lighten the other, or the
result is a box drawn around the content.

---

## Radius

Generous at the container level, tight at the control level — that contrast is most of what makes
a layout look composed.

`rounded-2xl` (18px) cards, tables, empty states · `rounded-xl` (14px) icon chips, tiles, nav
items · `rounded-lg` (10px) buttons and inputs · `rounded-full` pills, avatars, score tracks.

---

## Spacing rhythm

A 4px grid, used in a small number of steps rather than all of them.

| | |
|---|---|
| `gap-1.5` / `gap-2` | label to control, icon to text, pill to pill |
| `gap-3` / `gap-4` | items inside a card; cells in a stat strip |
| `gap-5` / `gap-6` | card to card down a page |
| `gap-8` / `gap-10` | one section of a page to the next |

Card padding is `px-5 py-5` stepping to `sm:px-6`. Table cells are `px-4 py-3.5`. Page shells are
`px-6 py-12` at `max-w-4xl` (a form or a detail) or `max-w-6xl` (a table or a board).

Pick from that list. A one-off `gap-[13px]` is how a system stops being one.

---

## The shell

`AppShell` in `components/coordinator-nav.tsx` is the only thing that renders navigation, and
`app/layout.tsx` is the only thing that renders `AppShell`.

- **`lg` and up** — a fixed 16rem rail (`--shell-sidebar-w`). Fixed rather than sticky so a long
  table scrolling under it never drags the navigation off screen. The content column is inset by
  the same variable from outside the pages, because the pages belong to other lanes.
- **Below `lg`** — a sticky 3.5rem top bar (`--shell-topbar-h`) with the mark and a menu button,
  and a drawer over an overlay. The breakpoint is `lg`, not `md`: a supervisor on a portrait
  tablet is 768px wide, which is enough for the content and not enough to give 256px of it away
  permanently.
- The drawer is a real dialog — `role="dialog"`, `aria-modal`, Escape to close, Tab kept inside
  it, focus returned to the button that opened it, and the page behind it locked from scrolling.
  It also closes itself when the viewport crosses the breakpoint, because otherwise the scroll
  lock survives onto a desktop layout that no longer shows the control to release it.

### The shell renders nothing on these paths

`/`, `/login`, `/privacy`, `/onboarding`, `/admin`, and the promoter token pages `/i/`, `/c/`,
`/a/`.

That list is not cosmetic. **A promoter opening a token link has no account and must never see an
agency's navigation, an agency's branding, or an agency's billing state** — and the same link is
routinely opened by a coordinator who *is* signed in, so a server-side session check alone is not
enough. On those paths `AppShell` returns its children and nothing else: no wrapper, no offset, no
header, no banner.

Anything agency-wide that has to live at the root goes through `AppShell`'s `banner` slot, which
is gated by the same check. Do not add it as a child of `AppShell` — a child renders on the
promoter pages.

---

## Reaching for the right component

| You are building | Use |
|---|---|
| the title row of any screen | `PageHeader` — `size="lg"` only for a screen that is somebody's home |
| the numbers under that title | `StatStrip` + `StatTile`. Tone is *your* judgement: 0 no-shows is `ok`, 0 covered is `bad` |
| a panel of related content | `Card`. `elevation="raised"` for the one card the page is about; `flush` when the body is a full-bleed table |
| rows of records | `Table`. `layout="fluid"` as soon as a column carries prose |
| a state word on a record | `Badge` — `ok`/`warn`/`bad`/`info`/`neutral`, never a bare coloured span |
| an action | `Button`. One `primary` per screen; `secondary` beside it; `subtle` for an accent-coloured second action; `ghost` in a toolbar or a row |
| an input | `TextField` / `SelectField` / `TextArea`. Always with a real `label`; `hint` for guidance, `error` for what went wrong |
| a match score, total or per-factor | `ScoreBar` — `tone="brand"` for the total, `tone="muted"` for the factors that explain it |
| nothing to show yet | `EmptyState`, with an `action` that creates the missing thing |
| a person in a list | `Avatar` beside the name — deterministic tint, so the same promoter is the same colour everywhere |
| a glyph | `Icon`. Inline SVG, no dependency, one 24×24 / 1.75-stroke grid |
| a Suspense fallback | `Skeleton` / `SkeletonText`, shaped like what is coming — and only for waits over ~200ms |

Composition beats configuration. Before adding a prop to a kit component, check whether the screen
can compose two existing ones.

---

## Interaction states

Every interactive thing in the product has all five, and the kit gives them to you:

1. **rest**
2. **hover** — a background step, or a border stepping from `--color-line` to `--color-line-strong`
3. **focus-visible** — `box-shadow: var(--focus-ring)`, which is a surface-coloured gap then the
   accent. It is a double shadow rather than an `outline` so it reads cleanly against a card, the
   canvas and a coloured banner alike. Use the `.focus-ring` utility for anything the kit does not
   cover. Never `outline: none` without a replacement.
4. **active** — `active:translate-y-px`. A one-pixel press is the cheapest way to make a control
   feel physical.
5. **disabled** — `opacity-50`, `cursor-not-allowed`, no shadow, and *no hover response*. A
   disabled control that still lights up under the pointer reads as broken rather than as off.

All of it eases on `--ease-out-soft` at 150ms so the whole product moves like one hand, and all of
it is suppressed under `prefers-reduced-motion`, which `globals.css` handles globally.

---

## Touch and narrow screens

The promoter pages are phone-first and the coordinator pages are opened on phones more than anyone
plans for.

- **44px is the floor for anything you tap.** `Button md` and every field control are 44px, which
  is also why they match each other.
- Heights are `min-h-*`, not `h-*`. A Greek label that wraps grows its control instead of spilling
  out of it.
- A wide table scrolls inside its own box, never by widening the page. `Table`'s wrapper carries
  `.scroll-shadow-x` — a pure-CSS edge shadow that appears only on a side that actually has more
  content, so the last visible column no longer looks like the end of the data.
- The body never scrolls horizontally. If something is too wide, it gets its own scroller.

---

## Adding to the system

1. **A new colour** — almost certainly no. Say what it *means*; if the meaning is already
   `ok`/`warn`/`bad`/`accent`/`neutral`, use that.
2. **A new token** — add it to `app/globals.css` with a comment saying what it is for, and add it
   to this file. Token names are a public API: values may be tuned, names are never removed.
3. **A new icon** — add a path to `components/ui/Icon.tsx`: 24×24 viewBox, `stroke="currentColor"`,
   `fill="none"`, 1.75 stroke, round caps and joins, no colour inside the path. Never add an icon
   dependency.
4. **A new component** — only when two screens need the same thing. Export it from
   `components/ui/index.ts` below the line, and write its doc comment as an argument for the
   design decisions, not a description of the props.
5. **A user-facing string** — there are none in `components/ui/`. The kit takes strings as props;
   the screen supplies them from `t()`. `coordinator-nav.tsx` is the single exception and its keys
   live under `shell.*` and `nav.*`.

And the one that catches people: **run `npm run build`, not `npm run dev`.** Server/client
boundary mistakes — a value exported from a `"use server"` module, a constant imported from a
`server-only` one — are invisible in dev and fatal in production. See `CLAUDE.md`.
