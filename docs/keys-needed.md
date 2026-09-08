# Keys and accounts needed from Stella

Everything else is built around these. Each entry says what is already built, what is blocked without
the key, and exactly where to get it.

**Nothing here blocks the v1 build.** Each integration is written behind an adapter or a feature flag,
so the product runs without the key and switches on when it arrives.

**Status legend:** 🔴 blocks a feature · 🟡 needed before a real user · ⚪ needed before revenue

---

## 🟡 1. Transactional email (magic-link login)

**Why:** Supabase's built-in email sender is rate-limited to a handful of messages per hour and its
deliverability into Greek inboxes is unreliable. Login is the front door; if the email does not
arrive, nothing else matters.

**What is built without it:** the whole auth flow. It works today with Supabase's default sender,
which is fine for testing alone and not fine for anyone else.

**What to get:** a [Resend](https://resend.com) account (free tier covers early use), then an API key.
A domain you own must be verified for the "from" address — sending as `@gmail.com` will land in spam.

**Where it goes:** `RESEND_API_KEY` in `.env`, plus SMTP settings in the Supabase dashboard under
Authentication → Email.

**Also needed:** a domain. If PromoterOS has no domain yet, that is the real first step — it also
gives us the production URL and the sender identity.

---

## ⚪ 2. Stripe (subscriptions)

**Why:** payments. See `docs/commercial-architecture.md` §3.

**What is built without it:** the entire billing surface — plan selection, subscription state on the
agency row, webhook handler, access enforcement, the upgrade and cancel flows. All of it runs against
Stripe **test mode**, which needs no verified business and no bank account. The switch to live is one
environment variable.

**What to get, in order:**
1. A Stripe account — test-mode keys are available immediately, before any business verification.
2. `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` (test mode is enough for now).
3. `STRIPE_WEBHOOK_SECRET` — created when the webhook endpoint is registered, so this comes after we
   deploy.
4. Before real money: business verification, an IBAN, and Stripe Tax enabled for EU VAT.

**Where it goes:** `.env`, and the three price ids once the products are created.

---

## 🟡 3. Domain and production hosting

**Why:** phone geolocation for check-in requires HTTPS, magic-link emails need a sender domain, and no
agency will trust `promoteros.vercel.app`.

**What to get:** a domain (`.gr` or `.com`), and a Vercel account connected to the repo. Vercel's free
tier is enough for v1 — but set the region to **Frankfurt (fra1)** so data stays in the EU, matching
the Supabase project.

---

## ⚪ 4. Geocoding provider (production)

**Why:** turning "Ερμού 15, Μαρούσι" into coordinates for distance matching.

**What is built without it:** the geocoding adapter with Nominatim (OpenStreetMap), which is free and
works now. Nominatim's usage policy does not permit commercial volume, so it is a development
provider only.

**What to get, before the first paying customer:** a [LocationIQ](https://locationiq.com) or
[Mapbox](https://mapbox.com) key. Both have free tiers well above what a few agencies would consume.

**Where it goes:** `GEOCODING_PROVIDER` and `GEOCODING_API_KEY`. One environment variable swaps it.

---

## ⚪ 5. WhatsApp Business (later, deliberately)

**Why:** the invitation channel promoters actually use.

**What is built without it:** everything. Invitations are signed links; the clipboard adapter renders
the exact message for the coordinator to paste into WhatsApp — which is what agencies do manually
today, so it is useful immediately.

**What it costs in time:** Meta business verification is **3–10 business days** and needs company
registration documents. Start it early precisely because we cannot control the wait; it does not block
anything in the meantime.

---

## Already provided ✅

| Key | Note |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Working |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Working |
| `SUPABASE_SERVICE_ROLE_KEY` | Working — **rotate before any real promoter data**, it was shared in plaintext |
| `TOKEN_SIGNING_SECRET` | Working |

## Not needed

| Key | Why not |
|---|---|
| `ANTHROPIC_API_KEY` | The AI features (natural-language search, report summarisation) are L5. The matching engine is deliberately not an LLM |
| Google Maps | Haversine distance needs no API. Travel-time routing is L6 |
