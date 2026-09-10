# Deploy

Everything here that could be automated has been. What is left needs an account only Stella can
create, so each step says exactly what to click and what to paste.

**Do the steps in order.** Step 3 in particular breaks silently if step 2 was skipped.

---

## 0. Before you start

The repository has **no secrets in it**. Verified: `.env` is untracked, `.gitignore` covers `.env`,
`.env.*`, `*.csv` and `*.xlsx`, and `git ls-files` returns nothing matching a credential pattern.
The only committed env file is `.env.example`, which has empty values.

**Make the GitHub repository private anyway.** It contains the matching engine, the schema and the
commercial architecture — the parts of this that are actually worth something.

---

## 1. GitHub

The project is a local git repository with its full history and no remote. Create the remote and push:

```bash
gh repo create promoteros --private --source=. --remote=origin --push
```

If the `gh` CLI is not installed — it currently is not — create an empty **private** repo named
`promoteros` at [github.com/new](https://github.com/new), **without** a README, `.gitignore` or
licence, then:

```bash
git remote add origin https://github.com/<your-username>/promoteros.git
git branch -M main
git push -u origin main
```

The local branch is currently `master`; the `-M main` renames it, which is what Vercel and GitHub
both default to.

---

## 2. Vercel

1. [vercel.com](https://vercel.com) → sign in **with GitHub** → **Add New… → Project** → import
   `promoteros`.
2. Framework preset: **Next.js**. Leave the build and output settings alone — the defaults are right.
3. **Region: Frankfurt (`fra1`).** Not the default US region. The Supabase project is in the EU and
   promoter records are personal data of EU residents; keeping compute in the same jurisdiction is
   the whole reason the database was placed there.
4. **Do not deploy yet.** Add the environment variables first — step 3 — or the first build will
   produce a site whose promoter links point at `localhost`.

---

## 3. Environment variables

In Vercel → Settings → Environment Variables. Copy the values from your local `.env`, **except
`NEXT_PUBLIC_APP_URL`, which must change.**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | from `.env` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | from `.env` — **mark it as sensitive** |
| `TOKEN_SIGNING_SECRET` | from `.env` — **sensitive** |
| `NEXT_PUBLIC_APP_URL` | **`https://<your-project>.vercel.app`** — see the warning below |
| `NEXT_PUBLIC_LEGAL_ENTITY_NAME` | `Στέλλα Πετροπούλου` |
| `NEXT_PUBLIC_PRIVACY_EMAIL` | `st.petrop1106@gmail.com` |
| `MESSAGING_ADAPTER` | `clipboard` |

> ### Never mark anything "Sensitive" in this project
>
> Vercel offers a **Sensitive** environment-variable type that cannot be read back after saving.
> It sounds like the safe choice. On this project it silently breaks the product, and it cost an
> afternoon to diagnose because each symptom looked like a different bug:
>
> - **Not available at build.** `NEXT_PUBLIC_*` values are inlined into the browser bundle while
>   building, so they became `undefined`. `/privacy` threw its own guard and `/login` could not
>   construct a Supabase client — both 500, while the landing page looked perfectly fine.
> - **Not available at runtime either**, on this account. `SUPABASE_SERVICE_ROLE_KEY` was missing
>   inside server actions, so the waitlist form crashed and `/i/[token]` returned 500 — for a token
>   that rendered correctly against the same database from a local production build.
>
> Use **Encrypted**, which is Vercel's normal storage for secrets: encrypted at rest, readable only
> by project members, available to build and runtime. It does **not** leak to the browser — Next
> inlines only `NEXT_PUBLIC_*`, and the two real secrets do not carry that prefix.
>
> A diagnosis note worth keeping: `/i/<invalid-token>` is **not** a test of the service-role key.
> `verifyToken` rejects a malformed token and returns before the database client is ever built, so
> that page renders "expired" whether the key works or not. Mint a real token.

> ### `NEXT_PUBLIC_APP_URL` is the one that will bite
>
> `linkFor()` in `lib/tokens.ts` builds every promoter link from it — the invitation at `/i/[token]`
> and the check-in at `/c/[token]`. Leave it as `http://localhost:3000` and every link you send a
> promoter opens nothing on their phone, while everything looks perfectly fine to you.
>
> Set it to the deployed origin with no trailing slash.

`STRIPE_*` and `RESEND_API_KEY` are deliberately absent. The product runs without them: billing
screens say billing is not configured, and no agency is ever locked out for it — see `docs/status/P22.md`.

---

## 4. Supabase — allow the new origin

Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-project>.vercel.app`
- **Redirect URLs:** add `https://<your-project>.vercel.app/login/callback`
  Keep `http://localhost:3000/login/callback` as well, so local development still works.

**Skip this and login fails on production only** — the magic link will be rejected as an untrusted
redirect, with everything still working perfectly on your machine.

---

## 5. Deploy and check

Deploy, then walk these in order. Each one has failed for a real reason during this build, so none
of them is ceremony:

| # | Check | What it proves |
|---|---|---|
| 1 | `/` renders | The landing page and the waitlist form are live |
| 2 | Submit the waitlist form | The insert, the rate limiter and the honeypot all work in production |
| 3 | `/privacy` renders | The legal-entity variables reached the build |
| 4 | `/login` → real email → link arrives → `/shifts` loads | Auth works with the production redirect URL |
| 5 | Open a shift, invite someone, open the link **on your phone** | `NEXT_PUBLIC_APP_URL` is right |
| 6 | Check in from the phone, with GPS | **The one thing that cannot be tested any other way** — geolocation needs HTTPS, which localhost fakes and a LAN IP does not |
| 7 | `npx tsx --env-file=.env scripts/waitlist-export.ts` | You can read your own signups |

Step 6 is the reason to deploy at all before you have a domain.

---

## 6. A custom domain, later

Nothing here needs redoing. Vercel → Settings → Domains → add it, follow the DNS records, then
update `NEXT_PUBLIC_APP_URL` and the two Supabase URLs to the new origin and redeploy. Ten minutes.

Worth doing **before** the waitlist link goes to any community: a `.gr` costs about €15 a year, and
`promoteros.vercel.app` reads as unfinished to an agency deciding whether to trust you with their
staff roster.

---

## 7. What is still not covered by deploying

- **Email deliverability.** Supabase's built-in sender is rate-limited and lands in spam. Real login
  emails need Resend and a verified sending domain — `docs/keys-needed.md` §1. Until then, sign-in
  works reliably only for addresses you test yourself.
- **Payments.** Stripe test mode needs no business verification and is a half-hour of setup when you
  want it — `docs/billing-setup.md`.
- **Backups.** Supabase's free tier keeps limited automatic backups. Before a real customer's data
  is in here, take one and **restore it into a scratch project** — an untested backup is not a
  backup. That is G5 in `docs/build-plan.md` §11.
