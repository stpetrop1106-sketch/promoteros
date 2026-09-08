# PromoterOS — Product Specification

The source of truth for *what* we are building. `roadmap.md` decides *when*.

## The problem

In a promotion agency, creating one schedule means a coordinator manually: checking who is available,
who is near the location, who has the right profile, who completed the brief, who has a car when one is
needed — then calling them, waiting for answers, finding replacements when someone cancels, sending the
programme details, confirming arrival at the store, collecting field photos, updating the client, and
handling whatever goes wrong. A supervisor drives store to store with no optimised route and forwards
photos from every promoter to the coordinator by hand.

With hundreds of promoters this becomes hundreds of conversations and phone calls per week.

**Goal:** the coordinator should only have to touch the cases that genuinely need a human.

---

## 1. Promoter database

One profile per promoter, replacing scattered spreadsheets and chat threads:
name, phone, email, areas they can work, availability, transport, experience, specialities,
past projects, brands worked with, completed briefs, cooperation status, work history.

## 2. Availability

Promoters declare availability in the system, including partial days
("Thursday — available after 17:00"). The coordinator stops messaging dozens of people to find out
who can work.

## 3. Campaigns

Each programme is a campaign holding everything in one place: client, location, date, hours,
number of promoters required, promotion type, dress code, brief, rate.

## 4. Smart matching

The system evaluates available promoters against: availability, distance, transport, experience,
skills (supermarket / beauty / perfume / events), brief completion, and history with that client
or brand. It returns a ranked list with a **visible reason for each ranking** —
`Maria — 96% · 4.2 km · available · perfume experience · worked this brand · brief done`.

The coordinator picks from the shortlist instead of searching the whole database.

## 5. Automated communication

Once selected, the promoter receives the shift offer with **Accept / Decline**.
Their answer updates the status automatically. The coordinator does not process replies by hand.

## 6. Replacement management

Last-minute cancellations are the single biggest operational pain. When a promoter cancels, the system
re-ranks available candidates and starts the replacement flow — time-boxed offers going down the
ranked list — instead of the coordinator phoning people one by one.

## 7. Check-in

The system asks the promoter to confirm arrival at the start of the shift. The coordinator sees a
status board (checked in / waiting / no response) and intervenes only where there is a real problem.

## 8. Exception handling

The system recognises late check-in, no response, cancellation, absence, time change, location change —
and surfaces **only the cases needing human attention**. The point is not to automate the human away;
it is that the human only handles what deserves them.

## 9. Brief management

Each campaign carries its brief: objective, products, offers, key talking points, dress code, store
instructions, supervisor details, reporting requirements. The promoter reads it before the shift;
the agency sees who has completed it.

## 10. Field reporting

After the shift: units promoted, sales, customer feedback, stock-outs, photos, store information,
store manager name, promoter observations — attached to the campaign and the store instead of
disappearing into a group chat.

## 11. Client reporting

Campaign-level rollup: stores, promoters, completed shifts, samples distributed, customer
interactions, plus photos, feedback, observations, problems, and per-store results.

## 12. AI coordinator

Natural-language queries over the same data — *"Find two promoters for tomorrow's activation in
Glyfada"* — resolving to the structured filters above. See `CLAUDE.md` for the deliberately narrow
role AI plays: query translation and report summarisation, never the ranking itself.

---

## Roles

| Role | Sees |
|---|---|
| **Coordinator** | Everything in their agency: campaigns, promoters, matching, invitations, exceptions |
| **Promoter** | Only their own shifts, briefs, check-in and field reports. No login — signed links |
| **Supervisor** | The stores and shifts they cover; collects and forwards field data |
| **Client** | Read-only view of their own campaigns and reports. Never other clients' data |

## What this is not

Not a payroll system. Not an invoicing system. Not a marketplace — promoters belong to one agency and
are never visible across tenants. Not an internal-employee shift scheduler; the client, the brief and
the freelancer pool are what make this different from Deputy or Connecteam.
