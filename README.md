# Card Comp Tracker

A personal sports card collection tracker. Stores the cards you own and
shows a current estimated value for each one, derived from real sold
listings. Started as a single-user local app; now deployed for a small
private beta (you + one other person) as an installable web app — see
"Deploy" below.

**Core principle: the LLM retrieves individual sales; deterministic code
computes the value.** Nothing ever asks a model "what is this card worth."
Retrieval asks for sold rows and stores them; a pure TypeScript function
scores them, so the same inputs always produce the same output.

## Stack

- Next.js (App Router) + TypeScript, Tailwind
- Postgres via Prisma (Vercel Postgres/Neon in production; any reachable
  Postgres for local dev)
- Vercel Blob for uploaded card photos in production; local filesystem
  (`public/uploads/`) when no Blob token is configured
- Anthropic SDK (`@anthropic-ai/sdk`, `claude-sonnet-5`) for comp
  retrieval (web search) and card identification from photos (vision)
- Vitest for tests

No auth, no payments — a handful of trusted people share one deployment.
Not a native app; installed to the home screen from Safari/Chrome, which
gets you the same full-screen, app-like experience without an Apple
Developer account or App Store review. See "Deploy" for the native-app
path if you want one later.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL + ANTHROPIC_API_KEY
npm run db:migrate                 # applies migrations to DATABASE_URL
npm run db:seed                    # adds a couple of example cards
npm run dev
```

`DATABASE_URL` needs a real, reachable Postgres — either your deployed
instance (simplest: one database for local dev and production) or a local
one. `BLOB_READ_WRITE_TOKEN` is optional locally; without it, uploaded
photos are written to `public/uploads/` on disk instead of Vercel Blob.

Run the test suite:

```bash
npm test
```

## Data model

One row in `CopyOwned` = one physical card I own, not one card type — I may
own the same card in several conditions. See `prisma/schema.prisma` for the
full model; the tables are:

| Table | Purpose |
|---|---|
| `Card` | Canonical card identity (year, brand, set, player, card number, parallel, etc.) |
| `CopyOwned` | A physical copy I own, in a specific grade |
| `Sale` | One observed SOLD listing — **append-only**, never updated or deleted |
| `Valuation` | A computed estimate snapshot, with the exact `Sale` rows that produced it |

Every `Valuation` records which `Sale` rows it was computed from
(`ValuationSaleUsed`), so any past estimate is reproducible from the data
that existed at the time.

## Comp scoring

`lib/valuation/computeValuation.ts` is the deterministic scorer — a pure
function, fully covered by `lib/valuation/computeValuation.test.ts`. Given
every known `Sale` for a card, it:

1. Filters to sales within the last 180 days
2. Filters to an exact grade match
3. Returns `sufficient: false` (never a fabricated number) below 3 sales
4. Trims the top/bottom 10% by price, once n ≥ 8
5. Recency-weights each sale (`0.5 ^ (daysAgo / 30)`, 30-day half-life)
6. Takes the weighted median as `value`, weighted 25th/75th as `low`/`high`

It never averages, and never falls back to a mean when the median is
inconvenient.

## Comp retrieval

`lib/sources/AgentSource.ts` retrieves sold comps via the Claude API's
`web_search` tool (`claude-sonnet-5`) — it never scrapes a marketplace
directly. It's defensive by design: `lib/parsing/extractJson.ts` pulls the
JSON payload out of the response even if the model adds markdown fences or
a stray sentence of prose around them (a real failure mode — see git
history), `JSON.parse`s inside a `try/catch`, validates the shape with
zod, and drops (logging as it goes) any sale missing a `sourceUrl` rather
than throwing. On any failure — a bad response, a refusal, an API error —
it returns `[]` and logs what happened; it never fabricates a sale.

`lib/sources/ApiSource.ts` is a stub for a future paid card-data API —
`fetchSales` throws `NotImplementedError`.

Every API call's token usage is appended to `logs/usage.jsonl` (gitignored)
via `lib/logging/costLog.ts`, so cost is visible locally without the
Anthropic console.

Try it:

```bash
npm run comp -- --player "Brayden Burries" --year 2025 --grade RAW \
  --brand Topps --set "Chrome McDonald's All American" \
  --cardNumber EA-BB --isAuto --sport Basketball
```

This finds-or-creates the `Card` row, retrieves sales, stores any new ones
(deduped by `sourceUrl`), then runs `computeValuation` against every `Sale`
on record for that card + grade — not just what this run retrieved. If an
owned copy matches this card + grade, the result is also persisted as a
`Valuation` snapshot (same as the in-app button below); otherwise it's
computed and printed only. Requires `ANTHROPIC_API_KEY` in `.env.local`.
The Burries fixture is a thin market: `sufficient: false` is the correct
result.

`lib/valuation/persistSales.ts` (dedupe-on-insert) and
`lib/valuation/computeAndPersistValuation.ts` (score + write a `Valuation`
+ its `ValuationSaleUsed` rows) are shared between this CLI and the
in-app button, so both paths leave identical records.

## Searching for comps in the app

Each `CopyOwned` row on `/` has a **Search comps** button —
`POST /api/copies/[id]/refresh` — instead of needing the CLI.

**This is intentionally a fast, partial search, not an exhaustive one.**
The CLI's thorough default (up to 8 rounds of web search) took ~13–15
minutes end to end in testing — far longer than a serverless request can
run (this route sets `maxDuration = 60`). The button uses a much smaller
search budget (`AgentSource`'s `maxSearches` constructor option) so it
reliably finishes in well under a minute. Because `Sale` rows are
append-only and deduped by `sourceUrl`, nothing is lost between clicks:
searching again later adds to what's already on record rather than
starting over, and the valuation gets more accurate as more sales
accumulate. A single click on a thin-market card may correctly report
`sufficient: false` — that's not a bug, click again later or after the CLI
has run a deeper search.

## Adding a card from photos

`/add` lets you skip typing entirely: take (or upload) a photo of the card
front, optionally the back, and Claude vision (`claude-sonnet-5`, high
effort) fills in year/brand/set/player/card number/parallel/grade/etc.
The prompt runs a literal-transcription pass before mapping fields — read
every visible character first, then fill the schema from that — rather
than pattern-matching from what a similar card "usually" has; it also
distinguishes a real ink/sticker autograph from a printed facsimile
signature, and prefers the back for card number/year when both photos are
given. It's still a vision model reading a photo, not a database lookup —
low confidence + null fields is the honest fallback when a photo is
blurry, cropped, or the back wasn't included, exactly like `AgentSource`
never fabricates a sale. **Nothing is written to the database until you
hit "Save to collection"** — a scan only ever returns JSON to the page.

- `POST /api/scan` — front (required) + back (optional) photo → structured
  attributes. Saves the photos (Vercel Blob in production, `public/uploads/`
  locally) either way, so a failed scan doesn't lose them.
- `POST /api/cards` — the confirmed/edited form → creates (or reuses, via
  the `Card` identity constraint) the `Card` row and a `CopyOwned` row.
- `/` (Collection) lists everything saved so far.

On a phone, `<input type="file" capture="environment">` opens the camera
directly.

## Deploy

The goal is a URL you and one other person can install to your home
screens tonight — not an App Store submission. Total cost: $0 (Vercel's
Hobby plan, Postgres, and Blob storage are all free at this scale).

1. **Push this branch, then import it on Vercel.** Go to
   [vercel.com](https://vercel.com), sign in with GitHub, **Add New →
   Project**, and import this repository. Vercel deploys every pushed
   branch automatically — you don't have to merge to `main` first; the
   branch's own URL (a "Preview" deployment) works exactly like production
   for a two-person beta.
2. **Add a Postgres database.** In the project → **Storage** tab →
   **Create Database** → Postgres (Neon-backed). Connect it to this
   project. That sets a `DATABASE_URL` env var for you. *(If the
   integration names it something else, like `POSTGRES_PRISMA_URL`, add
   one more env var yourself: `DATABASE_URL` = that same connection
   string — `prisma/schema.prisma` reads `DATABASE_URL` specifically.)*
3. **Add Blob storage.** Same **Storage** tab → **Create** → Blob →
   connect it to this project. That sets `BLOB_READ_WRITE_TOKEN`
   automatically — without it, uploaded photos would try to write to the
   serverless function's read-only filesystem and fail.
4. **Add your Anthropic key.** Project → **Settings → Environment
   Variables** → add `ANTHROPIC_API_KEY` (all environments).
5. **Redeploy** (Deployments tab → ⋯ → Redeploy) so the build picks up the
   new env vars. The build runs `prisma migrate deploy` automatically —
   the database schema is created on this first deploy, no manual step
   needed.
6. **Install it.** Open the deployment URL in Safari on your phone and
   your cousin's → Share → **Add to Home Screen**. You get a full-screen
   icon and app-like window (no browser chrome) — see `app/manifest.ts`
   and `app/apple-icon.tsx`.

**If you want a real App Store / TestFlight app later**, the cheapest path
from here is wrapping this same deployed app in a thin native shell
(Capacitor) rather than rewriting it — that needs an Apple Developer
account ($99/yr) and a Mac with Xcode to build/submit, neither of which
this environment has, so that step happens on a Mac you control. Everything
built so far (API routes, DB, auth-free design) carries over unchanged.

## Build milestones

- [x] **M1** — Schema, migrations, seed script, comp scoring function with
      full unit test coverage. No UI, no API calls.
- [x] **M2** — `AgentSource` (Claude + web search) and a CLI script to
      print retrieved sales and the computed valuation.
- [~] **M3** — Collection + card detail UI, manual entry, a "refresh
      value" button per card. Collection list, valuation display, and the
      refresh button ("Search comps") all exist; no dedicated card-detail
      screen (showing the full sale-by-sale backing list) yet.
- [~] **M4** — Image upload + card identification with the
      confirm-before-save form. Built ahead of M3 by request — see "Adding
      a card from photos" above.
- [ ] **M5** — Scheduled weekly refresh job with per-run cost logging.

## Test fixture

`Brayden Burries` — 2025 Topps Chrome McDonald's All American, card #EA-BB,
autograph, raw (ungraded) — is seeded as an end-to-end fixture. It's a thin
market: the correct result is `sufficient: false`, and the UI (M3) is
expected to handle that gracefully rather than show a made-up number.
