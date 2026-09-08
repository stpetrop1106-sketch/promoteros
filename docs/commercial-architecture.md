# Commercial architecture

How PromoterOS works as a business: who has an account, how they pay, how we support them, and what
we can see. Written now because these decisions are shaped into the schema, and retrofitting them
against live customer data is the most expensive work in this codebase.

---

## 1. The account model

Three kinds of people. Only two of them have logins, and that distinction is deliberate.

| Who | Logs in? | Is | Sees |
|---|---|---|---|
| **Agency owner** | Yes | The billing entity's admin | Everything in their agency, plus billing and team |
| **Coordinator / supervisor** | Yes | Staff of one agency | Their agency's operational data. No billing |
| **Promoter** | **No** | A data subject, not a user | Only their own shift, via a signed expiring link |
| **Platform admin (us)** | Yes, separately | Not part of any agency | Support surface only, audited — see §5 |

**Promoters never get accounts.** This is a product decision with three consequences worth stating:
it removes the single biggest adoption barrier (a freelancer will not install and maintain a work app
for one shift a month), it keeps the pricing honest because we never charge per promoter, and it
means a promoter's exposure is one link scoped to one record rather than a standing credential.

**Agency = tenant = billing entity.** One `agencies` row is one subscription, one dataset, one
isolation boundary. Nothing crosses it. Ever.

## 2. Sign-up and onboarding

The path from stranger to working product. Every step is a place someone gives up, so each one has
to justify itself.

```
Landing page → Request access / Start trial
   → Email magic link (no password to invent, no password to forget)
   → Create agency: name, city, timezone
   → Guided first run:
        1. Add your first three promoters      (or skip)
        2. Create your first campaign          (or skip)
        3. Create a shift and see the ranking  ← the aha moment
   → Invite your team (optional, skippable)
   → 14-day trial, no card required
```

**No credit card for the trial.** A card wall before the aha moment converts badly for a product
whose value is only visible once real data is in it.

**The first run must reach a ranked shift.** That screen is the product; an onboarding that ends
before it has failed. If the user skips everything, seed their agency with a small demo campaign
they can delete — an empty product teaches nothing.

## 3. Pricing and billing

Flat per-agency tiers, priced in EUR, annual discount. Not per-active-promoter — see `decisions.md`
and the research finding that variable pricing peaks the bill exactly when an agency is busiest and
most stressed.

| Tier | Price | Includes |
|---|---|---|
| **Starter** | €149 / month | 3 staff users, up to 150 promoters, unlimited shifts |
| **Agency** | €249 / month | 10 staff users, up to 500 promoters, client reports, exports |
| **Multi-brand** | €499 / month | Unlimited staff, 1,500 promoters, own branding on promoter pages, API |
| Annual | −2 months | Paid upfront; Greek SMEs expect an annual invoice |

**"Same price in December and in August" is the pitch.** Predictability is the differentiator against
Ubeya's per-active-worker model, not cheapness.

### Implementation

**Stripe, using Checkout and the Billing Portal rather than a bespoke flow.** Reasoning: card data
never touches our servers, EU VAT and reverse-charge are handled by Stripe Tax, invoices are
generated and archived automatically, and self-serve card updates and cancellation cost us no code.
A custom billing UI is weeks of work and a PCI liability for no customer benefit.

```
subscribe    → Stripe Checkout session → webhook → agencies.subscription_status
manage       → Stripe Billing Portal (card, invoices, cancel, VAT id)
enforcement  → middleware reads subscription_status; past_due keeps access,
               canceled becomes read-only, never deletes data
```

**Subscription state lives on the agency row**, written only by the webhook handler, never by the UI:
`trialing | active | past_due | canceled | paused`.

**Dunning is deliberately gentle.** A failed card must never lock a coordinator out mid-campaign with
promoters standing in stores. `past_due` keeps full access for 14 days with an in-app banner;
`canceled` drops to read-only and export-only. **We never delete a customer's data for non-payment** —
we keep it for the retention period and say so in the contract, because a deleted roster is a
catastrophe for them and a lawsuit for us.

**Greek specifics to resolve before the first paying customer:** Stripe issues the invoice, but a
Greek entity also has myDATA reporting obligations. That is an accountant question, not a code
question, and it is on the pre-revenue checklist rather than the build plan.

## 4. What the customer can do without us

Anything they can do themselves is support we do not provide and friction they do not feel.

- Change card, download invoices, update VAT id, cancel — Stripe Billing Portal
- Invite, remove, and change the role of staff users
- Export all of their data (promoters, campaigns, shifts, reports) as CSV, any time, without asking
- Delete a promoter, honouring the promoter's own erasure right
- Close the account, with an export offered first

**Data export is not a retention risk, it is a sales feature.** An agency that knows it can leave is
more willing to arrive.

## 5. The admin console — what *we* can see

The most sensitive surface in the product. It is where a support request becomes a privacy incident
if built carelessly.

**Platform admins are not an agency role.** They live in a separate `platform_admins` table, checked
independently of `app_users`. An agency owner can never become a platform admin by editing their own
row.

| Capability | Rule |
|---|---|
| List agencies, subscription state, usage counts | Always available. Aggregates, not contents |
| View a customer's operational data | **Read-only, reason required, logged.** Never silent |
| Act as a user, to reproduce a bug | Explicit "support session", time-boxed, banner visible in the UI, every action logged |
| Extend a trial, change a plan, issue a credit | Logged |
| Suspend an agency | Logged, reversible, never deletes |
| Delete data | Only to fulfil an erasure request, two-step confirmation, logged, export taken first |
| Raw SQL against production | **Not a feature.** If it is needed, it is a missing admin tool |

**Every admin action writes an audit row**: who, what, which agency, when, and why. This is what lets
us answer "did anyone at PromoterOS look at our data?" with evidence rather than assurance. It is
also the difference between a support tool and a liability.

## 6. Idiot-proof — what it actually means here

The word is easy to say and hard to specify, so it is specified.

### Customer side

- **One primary action per screen.** If everything is emphasised, nothing is.
- **Empty states teach.** "No promoters yet" is a failure; "Add your first promoter — you need at
  least three before the ranking is useful" is onboarding.
- **Destructive actions are hard and reversible.** Archive rather than delete; a real delete needs
  the name typed; anything cancelled shows an undo for 10 seconds.
- **Nothing silently fails.** Every action ends in a visible confirmation or a specific error saying
  what to do next. Never "Something went wrong".
- **Validation at the point of entry**, in plain Greek, next to the field, before submission.
- **No dead ends.** Every error screen offers a route forward.
- **The dangerous action is never adjacent to the common one.** "Cancel shift" does not sit beside
  "Send invitations".

### Admin side

- **Read-only by default.** Acting requires an explicit mode change, which is visible and logged.
- **Confirmation shows consequences**, with counts: "This suspends 1 agency, 4 users and 312
  promoters."
- **No bulk destructive operation without an export first.**
- **The audit log is not filterable to nothing** — you cannot hide your own actions.
- **Production credentials are never in the browser.** The admin console talks to the same API as
  everyone else, with elevated authorisation and a paper trail.

## 7. What this adds to the schema

Shaped now, built in parcels P17–P19. Recorded so nobody designs around a gap.

```
agencies              + subscription_status, plan, trial_ends_at,
                        stripe_customer_id, stripe_subscription_id,
                        promoter_limit, seat_limit

app_users             + role: owner | coordinator | supervisor   (extends the existing enum)
                      + invited_by, invited_at, accepted_at

platform_admins         id (= auth.users.id), full_name, created_at
                        deliberately separate from app_users

admin_audit_log         id, admin_id, action, agency_id, target_type,
                        target_id, reason, ip, created_at

agency_invitations      id, agency_id, email, role, token_hash,
                        expires_at, accepted_at
```

Note `admin_audit_log` has no update or delete path in the application. It is append-only by design.
