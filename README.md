# PromoterOS

Operating system for promotion and field-staffing agencies — matching, invitations, replacements,
check-ins and field reporting, so a coordinator only handles what needs a human.

## Where things are

| File | What it is |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Working agreement for AI agents. Identical, kept in sync |
| `docs/product-spec.md` | What we are building |
| `docs/roadmap.md` | What we build when — layers L0–L6 |
| `docs/data-model.md` | The schema |
| `docs/decisions.md` | Why things are the way they are, and the open questions |

## Getting started

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

Seed data is synthetic and generated. **Never load real agency data into this project** —
see `CLAUDE.md` §1.
