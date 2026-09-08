# Status protocol

Every agent working on a parcel keeps one file here: `docs/status/<PARCEL>.md`.

This is how the manager knows where everyone is without interrupting them, and how we guarantee two
agents never write the same file. **Updating your status file is not optional and not the last step —
it is the first thing you create and you update it as you go.**

## Rules

1. **Create your status file before writing any code.** First action of the parcel.
2. **Update it when anything changes**: a file added to your ownership, a blocker, a request to
   another lane, a decision taken. At minimum: on start, on each meaningful step, on finish.
3. **Never edit another parcel's status file.** If you need something from another lane, write it
   under `## Requests to other lanes` in *your* file. The manager routes it.
4. **List every file you create or modify** under `## Files touched`, as you touch them. This is the
   collision-detection mechanism. A file that appears in two status files is an incident.
5. **If you need a file you do not own, stop and request it.** Do not edit it "just this once".
6. **If you are blocked, say so immediately** with `Status: blocked` and what you need. A blocked
   agent that keeps working around the blocker creates the mess.

## Template

Copy this exactly.

```markdown
# <PARCEL ID> — <title>

**Lane:** <A|B|C|D>
**Status:** not_started | in_progress | blocked | in_review | done
**Updated:** <ISO timestamp>

## Owns
<the exact file globs from build-plan.md §8>

## Files touched
- path/to/file.ts — created | modified

## Done
- <what is finished and verified>

## Doing now
- <the single thing in progress>

## Blocked by
- <nothing, or the specific blocker>

## Requests to other lanes
- <lane> — <file> — <what you need and why>

## Notes for the manager
- <decisions taken, surprises, anything that changes the plan>
```

## Status meanings

| Status | Means |
|---|---|
| `not_started` | Assigned, not begun |
| `in_progress` | Being worked on right now |
| `blocked` | Cannot proceed. The manager must act |
| `in_review` | Code complete, awaiting the manager's integration check |
| `done` | Manager has verified acceptance criteria. **Only the manager sets this** |

An agent never marks its own parcel `done`. It marks `in_review` and stops.
