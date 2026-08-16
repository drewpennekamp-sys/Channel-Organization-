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

## UI

Four views, reachable from the left nav (a bottom tab bar on mobile):

- **Dashboard** (`/`) — total value, cards owned, gain on valued cards, how
  many need a comp search; a real recent-activity feed (cards added,
  valuations computed — derived straight from existing timestamps, nothing
  logged separately) and a "needs attention" shortlist.
- **Collection** (`/collection`) — every card as a photo tile, filterable by
  sport/graded/raw/needs-search and searchable by name.
- **Value** (`/value`) — total collection value, split honestly into what's
  actually valued from comps vs. what's still shown at purchase price; a
  holdings table with gain/loss per card. No fabricated trend line — the
  app doesn't track a historical portfolio series, so it doesn't pretend to.
- **Comps** (`/comps`) — per-card "Search comps," plus "Search my whole
  collection," which runs the same bounded search sequentially across every
  card with a live feed and progress bar (real requests, not simulated —
  each card still gets its own ~60s-budgeted search).

Design tokens (light/dark) and fonts (Oswald/Karla/JetBrains Mono, self-hosted
under `public/fonts/`) live in `app/globals.css`; `/add` (photo scan) keeps
its own plain form styling for now.

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
| `CatalogCard` / `CatalogParallel` | The scanner's reference data — what `(set, cardNumber)` resolves to and its known parallels. Not bulk-seeded; grows from confirmed scans — see "Adding a card from photos" |

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

## Adding a card from photos — the scanner

`/add` requires both a front and back photo and runs them through
`lib/scanner/scanCard.ts`, a 4-pass pipeline built around one idea: a
card's `(set, cardNumber)` is effectively a primary key and is printed in
plain text on the back, so identification is mostly OCR + catalog lookup,
not open-ended image recognition — with one genuinely hard step (the
parallel) isolated and defended instead of guessed.

1. **Slab check** — if the photo shows a graded PSA/BGS/SGC/CGC slab, OCR
   the cert number + grade and return immediately with `confidence: exact`.
   A cert number is an exact key; nothing else needs to run.
2. **Back read** (`lib/scanner/backRead.ts`) — OCR the identifiers off the
   back: card number (full string, prefix included, never stripped),
   copyright year, brand, set, serial numbering, player, sport. Never
   infers a card number from the player's identity — a guessed number is
   the single worst output this system can produce, so it's null instead.
3. **Catalog resolution** (`lib/scanner/catalogResolve.ts`) — pure,
   deterministic code, no model call: exact (brand, year, set, cardNumber)
   match, then (cardNumber, player, year±1) to absorb the late-release
   copyright-year offset, then (cardNumberPrefix, player) to pin an insert
   set. First rule to find a unique match wins; logged either way.
4. **Parallel read** (`lib/scanner/parallelRead.ts`) — the hard, honest
   step. The model picks from the resolved card's *known* parallels (a
   closed list) or says "uncertain" — never free-form. A response outside
   the list is treated as uncertain rather than trusted. Skipped entirely
   when a serial-numbering stamp already pins the parallel deterministically
   (see below).

**The catalog isn't bulk-seeded.** `CatalogCard`/`CatalogParallel` start
empty and grow one entry at a time from every confirmed save — scanned or
hand-typed (`lib/scanner/growCatalog.ts`, called from `POST /api/cards`).
The first scan of a new set is expected to come back `unresolved`; every
save after that teaches the catalog, so accuracy improves the more you use
it rather than depending on a one-time data import.

**Confidence is one of four levels, never a percentage** (false precision
you'd learn to ignore): `exact` (cert), `high` (catalog match + closed-list
parallel), `low` (catalog matched, parallel uncertain — candidates shown),
`unresolved` (no catalog match — raw OCR fields kept as a starting point,
nothing guessed). Stored on `CopyOwned.identificationConfidence` /
`.identificationMethod`. The confirm form highlights whatever's uncertain
in spot blue, and the parallel field always needs an explicit tap to
confirm — even at `high` confidence — because it's the field that most
changes value.

A serial-number stamp (e.g. "12/99") is treated as decisive on its own:
if Pass 1 read one and exactly one of the catalog's known parallels for
that card carries that print run, the parallel is resolved in code with
zero model calls — no need to ask a model to judge color under uncertain
phone-camera lighting for the one case a printed number already settles.

**Capture requirements**, enforced client-side before a photo ever
uploads (`lib/capture/imageChecks.ts`, canvas-based, no server round
trip): blur rejection (Laplacian variance), glare rejection on the front
(brightness histogram — chrome cards blow out under direct light and
glare is the top cause of parallel misreads), a rough card-fills-the-frame
check (edge-density bounding box, not true segmentation), auto-rotate to
portrait, best-effort deskew past ~5° (gradient-angle histogram, not a
full Hough line fit), and downscaling to 1600px before upload. These are
honest heuristics, not real computer vision — see the module's doc comment
for exactly what they do and don't catch.

Nothing is written to the database until you hit **Save to collection**.
Every scan pass's raw model output is logged alongside its parsed result
(`logs/scans.jsonl`, gitignored) and every API call's token cost is logged
too (`logs/usage.jsonl`) — so a wrong field is diagnosable (model misread
vs. parser bug) and cost is visible without the Anthropic console.

- `POST /api/scan` — front + back (both required) → a `ScanResult`. Saves
  the photos (Vercel Blob in production, `public/uploads/` locally)
  regardless of scan outcome, so a failed scan doesn't lose them.
- `POST /api/cards` — the confirmed/edited form → creates (or reuses) the
  `Card` row and a `CopyOwned` row, and grows the catalog.
- `/collection` lists everything saved so far.

Prompts live as plain text under `prompts/` (`slabCheck.txt`,
`backRead.txt`, `parallelRead.txt`), not inline string literals, so
they're diffable independent of the TypeScript around them.

`lib/scanner/scanCard.test.ts` and `lib/scanner/catalogResolve.test.ts`
are a mocked regression suite — no real photos, no live API calls; each
fixture stubs what a pass's model call would return and asserts on the
deterministic logic downstream (confidence level *and* field values, per
card: slab, clean base card, prefixed insert, copyright-year offset, two
parallels that must not conflate, a serial stamp as the only tell, an
off-list model response, and a vintage card with no card number that must
come back `unresolved` rather than guessed). `lib/capture/imageChecks.test.ts`
validates the blur/glare/coverage math directly on synthetic pixel data,
since the full canvas pipeline needs a real browser this test environment
doesn't have.

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
      value" button per card. Dashboard/Collection/Value/Comps views,
      valuation display, and the refresh button ("Search comps") all exist;
      no dedicated card-detail screen (showing the full sale-by-sale
      backing list) yet.
- [x] **M4** — Image upload + card identification with the
      confirm-before-save form. Built ahead of M3 by request, then rebuilt
      as the 4-pass OCR + catalog-lookup scanner (slab check, back read,
      catalog resolution, closed-list parallel read) — see "Adding a card
      from photos" above.
- [ ] **M5** — Scheduled weekly refresh job with per-run cost logging.

## Test fixture

`Brayden Burries` — 2025 Topps Chrome McDonald's All American, card #EA-BB,
autograph, raw (ungraded) — is seeded as an end-to-end fixture. It's a thin
market: the correct result is `sufficient: false`, and the UI (M3) is
expected to handle that gracefully rather than show a made-up number.
