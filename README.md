# Card Comp Tracker

A personal sports card collection tracker. Stores the cards I own and shows
a current estimated value for each one, derived from real sold listings.
Single-user, self-hosted, runs locally first.

**Core principle: the LLM retrieves individual sales; deterministic code
computes the value.** Nothing ever asks a model "what is this card worth."
Retrieval asks for sold rows and stores them; a pure TypeScript function
scores them, so the same inputs always produce the same output.

## Stack

- Next.js (App Router) + TypeScript, Tailwind, shadcn/ui
- SQLite via Prisma for local dev — schema is kept Postgres-compatible
  (no SQLite-only types, no native enums, no scalar-list columns) so a
  move to Supabase later is a datasource swap, not a schema rewrite
- Anthropic SDK (`@anthropic-ai/sdk`) for comp retrieval (web search) and,
  later, card identification (vision)
- Vitest for tests

No auth, no payments, no multi-tenancy, no mobile app — single local user.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in ANTHROPIC_API_KEY when you reach M2
npm run db:migrate                 # creates prisma/dev.db and applies migrations
npm run db:seed                    # adds a couple of example cards
npm run dev
```

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

## Build milestones

- [x] **M1** — Schema, migrations, seed script, comp scoring function with
      full unit test coverage. No UI, no API calls.
- [ ] **M2** — `AgentSource` (Claude + web search) and a CLI script to
      print retrieved sales and the computed valuation.
- [ ] **M3** — Collection + card detail UI, manual entry, a "refresh
      value" button per card.
- [ ] **M4** — Image upload and card identification with a
      confirm-before-save form.
- [ ] **M5** — Scheduled weekly refresh job with per-run cost logging.

## Test fixture

`Brayden Burries` — 2025 Topps Chrome McDonald's All American, card #EA-BB,
autograph, raw (ungraded) — is seeded as an end-to-end fixture. It's a thin
market: the correct result is `sufficient: false`, and the UI (M3) is
expected to handle that gracefully rather than show a made-up number.
