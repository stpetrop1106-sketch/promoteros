# The PromoterOS design system

Rewritten in P42a (`docs/status/P42a.md`) around a new visual identity. Everything visual lives in
three places:

| | |
|---|---|
| `app/globals.css` | tokens — colour, type, radius, elevation, shell geometry |
| `components/ui/**` | the kit — the components every screen composes |
| `components/coordinator-nav.tsx`, `app/layout.tsx` | the shell around the kit |

Nothing else styles anything. A screen that needs a colour, a size or a shadow reaches for a
token or a component; it does not invent one.

---

## What the product looks like, in one paragraph

**Warm ivory paper with white cards on it.** The canvas is ivory, not white and not grey. White is
reserved for surfaces that hold content — a card, a table, the active nav pill, the account row.
Borders are hairlines you have to look for, shadows are so diffuse they read as lift rather than as
a drop shadow, and corners are generous. Text is warm ink, never black-on-white. The only
saturated colour on a screen is a small pastel chip in the corner of a stat card and a status pill
on a row. One accent at a time; nothing is loud.

That description is the specification. If a change makes a screen louder, it is wrong even if
every token in it came from this file.

---

## The one rule that outranks the rest

**A component's look belongs to this system. A component's API belongs to the 73 screens that
call it.**

You may restyle anything in `components/ui/`. You may not rename an export, rename a prop, remove
a variant value, or change a default. New props are optional with a default that reproduces the
current rendering. That is why P42a's `StatTile` grew `delta`, `deltaTone` and `chip` — and why a
tile that passes none of them still renders — rather than anything changing shape.

---

## Colour

One warm neutral ramp, a near-black accent, one live colour, three status triples, five pastels.
There are no other colours. If a screen needs "a different blue", it needs a different component.

### Neutrals — `--color-n-0` … `--color-n-950`

A single warm ramp around 35–40°, so the canvas reads as paper rather than as a screen and every
border, divider and label sits on the same warm axis. A cool grey dropped onto this canvas looks
immediately like a foreign component pasted in. Use the ramp directly only when the semantic name
below does not exist.

### Semantic surfaces and text

| Token | Use it for |
|---|---|
| `--color-canvas` | the page behind everything — and the sidebar, which is the same ivory |
| `--color-canvas-sunken` | a well *inside* a surface: an input's rest fill, a progress track |
| `--color-surface` | white. Cards, tables, sheets, menus, the active nav pill, the account row |
| `--color-surface-hover` | a row or menu item under the pointer |
| `--color-ink` | headings, primary text, a stat card's number |
| `--color-ink-soft` | body copy inside a card, table cell values |
| `--color-muted` | labels, captions, hints — anything that explains rather than states |
| `--color-muted-soft` | placeholders, resting icons, disabled text |
| `--color-line` | the default hairline; borders and dividers |
| `--color-line-strong` | a border that has to be noticed — a control's edge, a dashed frame |

The hierarchy is real: four text tones and two line weights. If everything on a screen is
`--color-ink` on `--color-surface` with a `--color-line` border, the screen has no hierarchy and
will read as a prototype no matter how good the spacing is.

**White is a material, not a tint.** Because the sidebar and the canvas are the same ivory, putting
something on `--color-surface` is what says "this is a thing you act on". That is the entire
mechanism behind the active nav pill, and it is why a card's header band no longer carries a fill —
a second, slightly different white inside a white card spends the one signal the system has.

### Accent — `--color-accent`, near-black (#26221d)

The primary action, and nothing else. A primary button, the brand mark tile, the one control on a
screen that is the point of the screen. It works because the contrast does all the work: against
ivory a near-black pill is unmistakable without a drop of colour, which is what lets the rest of the
page stay quiet.

Keep one per screen. A page with three near-black buttons has no primary action.

`-subtle` / `-line` / `-ink` are the sand tint behind accent-coloured text (the `subtle` Button
variant, the `info` Badge). Never put `-ink` text on white and never put white text on `-subtle`.

### The live accent — `--color-action`, clay (#b4693c)

**Clay is the product's one live colour and it means "this is alive right now".** Reach for it in
exactly four places:

1. the icon on the **active** nav item — where you are;
2. the **focus ring**, everywhere, via `--focus-ring`;
3. the **border of a focused input**, so the ring and the edge are one hue rather than two;
4. a **score or chart fill** — `ScoreBar`'s `brand` tone, and any line a future chart draws.

That is the whole list. There is no clay button, no clay heading, no clay card. If clay appears
twice on a screen for two different reasons, one of them is wrong.

### Status — `ok` / `warn` / `bad`

Each is a triple: `--color-ok`, `--color-ok-subtle`, `--color-ok-line`, `--color-ok-ink`.

- the saturated base is for **icons, dots and solid fills only**
- the `subtle`/`ink` pair is for **everything with text in it** — pills, banners, tinted rows

A shift list is twenty status pills. At full saturation that is a page of traffic lights and the
coordinator cannot find the one row that is wrong, which is the only reason the column exists.

`--color-neutral-subtle` / `-line` / `-ink` completes the set so a "nothing has happened yet"
state has the same shape as the three that mean something.

**Colour is never the only carrier of meaning.** Every status pill has a word in it. `Badge`'s
`dot` prop adds a glyph *alongside* the word, never instead of it.

### The pastels — `--color-chip-{peach,mint,lilac,sand,rose}` and their `-ink`

Five soft fills for **icon chips only**: the square behind the glyph in a `StatTile`'s corner, the
chip beside a `PageHeader` title, an `EmptyState`'s glyph, an `Avatar`'s initials. Each has an
`-ink` dark enough to clear AA on it.

They are decorative and carry **no state**. That is the property that makes them right for an
avatar — a promoter is not "warn" — and it is why `bad` gets `rose` rather than reusing `peach`,
which belongs to the clay family and therefore means accent.

Never put body text on a pastel. They are 36–40px squares with a stroke icon in them, and that is
all they are.

---

## Type

Inter, loaded by `next/font` in `app/layout.tsx` with the `greek` subset requested explicitly —
`next/font` fails the **build** when a family lacks a requested subset, so Greek coverage is
verified by CI rather than by eye. Do not change the family without keeping that guarantee.

Every step carries its own line-height and tracking. Tracking tightens as size grows; the two
smallest steps carry positive tracking so Greek uppercase labels stay legible.

| Step | Size | Where |
|---|---|---|
| `text-2xs` | 11px | **the micro label.** Table headers, section labels, stat labels, `Detail` labels, an eyebrow |
| `text-xs` | 12px | hints, captions, a stat card's delta line |
| `text-sm` | 14px | **the app's body size.** Table cells, form controls, buttons |
| `text-base` | 16px | prose a promoter reads on a phone; an `EmptyState` title |
| `text-lg` | 18px | a card title that has to lead |
| `text-xl` – `text-2xl` | 21–24px | `PageHeader` at `md`, section headings |
| `text-3xl` | 30px | `StatTile` values, `PageHeader` at `lg` |
| `text-4xl`+ | 36px+ | the landing page only |

The micro step is doing a lot of work in this identity. A label that is 11px, uppercase, open-tracked
and muted reads as a caption on the thing below it rather than as a competing headline — which is
exactly the relationship a column header, a section label and a stat label should have to their
content. When you are unsure whether a label belongs at `text-xs` or `text-2xs`, ask whether it
*states* something or *explains* something. Explaining is `text-2xs`.

Weights are 400, 500 (a label), 600 (a heading, a button, a value). There is no 700 — at Inter's
optical sizes bold reads as shouting next to 600.

Greek runs 30–40% longer than English. **Design for the Greek string.** Anywhere a label can be
cut, cutting it loses the half that carries the meaning: `Βάρδιες χωρίς κάλυψη` truncated to one
line is `Βάρδιες…`. Prefer wrapping (`text-pretty`, `line-clamp-2`, a `min-h` that reserves the
second line) over `truncate`, and add `break-words` wherever a single unbreakable Greek uppercase
word has to survive a narrow column. `truncate` is for a value the user already knows — a name, a
store, an email address.

---

## Elevation

Reach for the semantic name, never a raw shadow utility, so a card and a popover cannot drift
apart across parcels.

| Token | Height | What sits there |
|---|---|---|
| `--elevation-flat` | 0 | a panel inside another panel; a section divider does the work |
| `--elevation-pill` | 0.5 | the white active nav pill, the account card — anything floating on a *tinted* ground |
| `--elevation-card` | 1 | the default. `Card`, `StatTile`, `Table`'s frame |
| `--elevation-card-hover` | 2 | a `Card interactive` under the pointer |
| `--elevation-raised` | 3 | the one card a page is actually about |
| `--elevation-overlay` | 4 | the mobile nav drawer, a menu, anything over content |

Every shadow is layered — a barely-there contact shadow plus a wide, very soft ambient one — and
tinted with the ink hue rather than black. P42a took most of the weight out of the contact layer:
the moment that tight layer is visible as a dark line under a card, the page stops looking like
paper and starts looking like objects with drop shadows.

`--elevation-pill` is deliberately lighter than `--elevation-card`, because a white pill on ivory is
already separated by being white. On a white card it would vanish, which is the correct signal that
it does not belong there.

**A border and a shadow share the work.** The border is a hairline (`--color-line`) precisely
because the shadow is doing the separating; darken one and you must lighten the other, or the
result is a box drawn around the content.

---

## Radius

Generous at the container level, fully round at the control level — that contrast is most of what
makes a layout look composed.

- `rounded-2xl` (24px) — cards, tables, stat tiles, empty states, the account card
- `rounded-xl` (18px) — icon chips, nav items, inputs, textareas, selects
- `rounded-full` — **every button and link-button**, every badge, avatars, score tracks, skeleton text

Buttons are pills in this identity, and that is not a flourish: a near-black pill and a white pill
side by side are the reference's two action shapes, and a pill cannot be confused with an input, a
card or a table cell at any size.

---

## Spacing rhythm

A 4px grid, used in a small number of steps rather than all of them.

| | |
|---|---|
| `gap-1.5` / `gap-2` | label to control, icon to text, pill to pill |
| `gap-3` / `gap-4` | items inside a card; cells in a stat strip |
| `gap-5` / `gap-6` | card to card down a page |
| `gap-8` / `gap-10` | one section of a page to the next |

Card padding is `px-5 py-5` stepping to `sm:px-6`. Stat tiles are `p-5` stepping to `sm:p-6`.
Table cells are `px-4 py-4` stepping to `sm:px-5`. Page shells are `px-6 py-12` at `max-w-4xl`
(a form or a detail) or `max-w-6xl` (a table or a board).

This identity runs on air. When a screen looks wrong and the colours are all correct, the answer is
almost always that something needs more room, not more contrast. Pick from the list above — a
one-off `gap-[13px]` is how a system stops being one.

---

## The shell

`AppShell` in `components/coordinator-nav.tsx` is the only thing that renders navigation, and
`app/layout.tsx` is the only thing that renders `AppShell`.

- **`lg` and up** — a fixed 16rem rail (`--shell-sidebar-w`) in the **same ivory as the canvas**,
  with no border and no shadow down its right edge. Anything drawn there turns the rail back into a
  panel, which is the one thing this identity does not do; the content column's white cards are what
  mark where the rail ends. Fixed rather than sticky so a long table scrolling under it never drags
  the navigation off screen. The content column is inset by the same variable from outside the
  pages, because the pages belong to other lanes.
- **The rail's contents** — a dark rounded-square brand tile, a micro uppercase section label, then
  the four destinations. The active one is a **white pill** with `--elevation-pill` and a clay icon;
  the rest are plain text with a thin outline icon and a whisper of white on hover. At the bottom,
  a second section label, the settings item, and the account row inside a **quiet white card**.
- **Below `lg`** — a sticky 3.5rem top bar (`--shell-topbar-h`), ivory with a hairline (unlike the
  rail: this bar sits *over* scrolling content and needs an edge), and a drawer over an overlay.
  The breakpoint is `lg`, not `md`: a supervisor on a portrait tablet is 768px wide, which is enough
  for the content and not enough to give 256px of it away permanently.
- The drawer is a real dialog — `role="dialog"`, `aria-modal`, Escape to close, Tab kept inside
  it, focus returned to the button that opened it, and the page behind it locked from scrolling.
  It also closes itself when the viewport crosses the breakpoint, because otherwise the scroll
  lock survives onto a desktop layout that no longer shows the control to release it. **None of
  that behaviour is cosmetic. Restyle the drawer; do not touch its effects.**

### `--focus-ring-gap`

The focus ring is a surface-coloured gap and then clay. The gap defaults to white because most
controls sit on a card; the ivory sidebar and the ivory top bar re-point it at the canvas with
`[--focus-ring-gap:var(--color-canvas)]`, and the account card re-points it back to white. Any
future surface that is not white should do the same, or a focused control on it wears a white halo.

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
| a person in a list | `Avatar` beside the name — deterministic pastel, so the same promoter is the same colour everywhere |
| a glyph | `Icon`. Inline SVG, no dependency, one 24×24 / 1.75-stroke grid |
| a Suspense fallback | `Skeleton` / `SkeletonText`, shaped like what is coming — and only for waits over ~200ms |

Composition beats configuration. Before adding a prop to a kit component, check whether the screen
can compose two existing ones.

### `StatTile`, specifically

The reference's stat card is the single most recognisable element in this identity, so it is worth
knowing what each part is for:

```
ΤΙΝΥ UPPERCASE LABEL                    [pastel chip]
42
↑ 12.5% από τον προηγούμενο μήνα
```

- **label** — `text-2xs`, uppercase, muted, clamped to two lines with a reserved `min-h` so every
  number in a strip lands on the same baseline. This is what makes a strip scannable.
- **value** — `text-3xl`, semibold, tabular, and **always ink**. The number is the thing being read;
  the chip and the delta say how to feel about it. A red number beside a red chip beside a red delta
  is three ways of saying one thing.
- **delta** (optional) — the caller supplies the whole sentence from `t()`; the tile adds an arrow
  and a colour from `deltaTone`. `up` is green, `down` is red, `flat` (the default) is muted.
  **`deltaTone` is sentiment, not arithmetic.** A rising no-show count is a `down`.
- **chip** (optional) — the pastel. Left out, it follows `tone`: neutral→lilac, accent→peach,
  ok→mint, warn→sand, bad→rose. Pass it explicitly when a strip has several tiles of one tone and
  the reference's four-colour row is what you want.

Do not put six tiles in one strip inside a `max-w-2xl` column. Each label gets sixty pixels and the
design has nowhere to go; `StatStrip`'s default grid is four across for a reason.

---

## Interaction states

Every interactive thing in the product has all five, and the kit gives them to you:

1. **rest**
2. **hover** — a background step, or a border stepping from `--color-line` to `--color-line-strong`
3. **focus-visible** — `box-shadow: var(--focus-ring)`, a gap the colour of the ground then clay.
   It is a double shadow rather than an `outline` so it reads cleanly against a card, the ivory and
   a coloured banner alike. Use the `.focus-ring` utility for anything the kit does not cover, and
   set `--focus-ring-gap` on any ground that is not white. Never `outline: none` without a
   replacement.
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
   `ok`/`warn`/`bad`/`accent`/`action`/`neutral` or one of the five pastels, use that.
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

And the one that catches people: **run `npm run build`, not `npm run dev`** — and then **open the
page**. Server/client boundary mistakes are invisible in dev and fatal in production, and a
function passed as a prop to a client component builds perfectly and throws on every load. See
`CLAUDE.md`.
