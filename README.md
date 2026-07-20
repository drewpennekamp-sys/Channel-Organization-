# Shorts Factory

Plan, generate, and post content across six YouTube Shorts channels split
between two people — daily ideas, a video log with analytics, AI-driven
insights that feed back into idea generation, and account-level settings.

Runs on Next.js (App Router) + Postgres, deployed to Vercel, gated behind a
shared password since it's a private two-person tool.

## Stack

- Next.js 14 (App Router, Route Handlers)
- Postgres via [Neon](https://neon.tech) (serverless HTTP driver — no
  connection pool to manage)
- Drizzle ORM
- Claude (Anthropic API) for channel analysis and idea generation
- `jose` for session JWTs, checked in Next.js Middleware

## Environment variables

Set these in **Vercel → Project → Settings → Environment Variables** for
Production (and Preview, if you want preview deployments to work). Locally,
put them in `.env.local` (already gitignored).

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string from Neon (or Vercel Postgres). Use the pooled connection string Neon gives you — the app talks to it over Neon's serverless HTTP driver, which is stateless per query, so there's no pool to exhaust either way. |
| `AUTH_PASSWORD` | Yes | The shared password both operators use to sign in. Pick something you'd be fine texting to the other person. |
| `AUTH_SECRET` | Yes | Random secret used to sign session cookies. Generate one with `openssl rand -base64 32`. Changing it logs everyone out. |
| `CRON_SECRET` | Yes (for auto-sync) | Random secret Vercel Cron sends as `Authorization: Bearer <value>` when it hits `/api/cron/sync`. Vercel automatically attaches this header for you once the env var exists — you don't wire that up yourself. Generate with `openssl rand -base64 32`. |
| `ANTHROPIC_API_KEY` | Yes (for idea gen + analysis) | Claude API key. Without it, idea generation and channel analysis fail with a visible error/banner in the app rather than a silent failure — everything else still works. |
| `VIDIQ_API_KEY` | No | vidIQ credentials for real stat syncing. The sync routes currently run as a stub (they stamp a "last synced" timestamp without pulling real data) until this integration is wired up to a live vidIQ call — see the `TODO(vidIQ sync)` comment in `lib/vidiq.ts`. |

No secret is read anywhere in a `'use client'` file — `ANTHROPIC_API_KEY`,
`VIDIQ_API_KEY`, `DATABASE_URL`, `AUTH_PASSWORD`, `AUTH_SECRET`, and
`CRON_SECRET` are only ever touched from Route Handlers, Server Components,
and `middleware.ts`, none of which ship their source to the browser. The
Settings screen's "API keys" section shows only a masked tail
(`••••ab12`), never the full value.

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in DATABASE_URL at minimum
npm run db:push                    # sync schema to your Postgres DB
npm run seed                       # optional: adds 3 example channels
npm run dev
```

## Deploying to Vercel (first time)

Do these in order:

1. **Create the Postgres database.** In Neon, create a project and copy the
   pooled connection string it gives you — that's your `DATABASE_URL`.

2. **Connect the repo to Vercel.** Import the repo in the Vercel dashboard
   (or `vercel link` from the CLI). Don't deploy yet.

3. **Set environment variables** in Vercel → Settings → Environment
   Variables: `DATABASE_URL`, `AUTH_PASSWORD`, `AUTH_SECRET`, `CRON_SECRET`,
   `ANTHROPIC_API_KEY`, and `VIDIQ_API_KEY` if you have it. Use the table
   above.

4. **Run the schema migration against the new database**, from your machine,
   pointed at the same `DATABASE_URL` you just set in Vercel:
   ```bash
   DATABASE_URL="<paste it>" npm run db:migrate
   ```

5. **Carry over any existing local data.** If you were running this locally
   before (SQLite) or have a previous "Export all data" backup from the
   Settings screen, load it into the new database once:
   ```bash
   DATABASE_URL="<paste it>" npm run db:import-backup -- path/to/backup.json
   ```
   If you're starting fresh, skip this and use `npm run seed` instead (also
   pointed at the same `DATABASE_URL`), or just add channels once the app is
   live.

6. **Deploy** (push to the connected branch, or `vercel --prod`).

7. **Verify the cron job is registered.** In Vercel → Project → Cron Jobs,
   confirm `/api/cron/sync` is listed with the `0 13 * * *` (once daily)
   schedule from `vercel.json` — the Hobby plan doesn't allow more frequent
   cron jobs, which is why this isn't every few minutes. It no-ops until
   `autoSyncEnabled` is turned on in Settings.

8. **Sign in.** Visit the deployed URL — you'll land on `/login`. Use
   `AUTH_PASSWORD`. Both operators use the same password; the You/Friend/All
   switcher in the header is a view filter, unrelated to login.

## Notes on the architecture

- **Auth**: `middleware.ts` gates every route except `/login` and
  `/api/auth/login` (and `/api/cron/*`, which uses its own `CRON_SECRET`
  check instead of a session cookie, since Vercel Cron isn't a logged-in
  browser). An unauthenticated request to any API route gets a `401`, not a
  redirect — only page navigations redirect to `/login`.
- **Background sync**: there's no always-on process on serverless, so the
  old client-side polling interval is gone. Vercel Cron hits
  `/api/cron/sync` once a day (the Hobby plan's cron frequency limit — Pro
  allows more often, in which case you can tighten `vercel.json`'s
  schedule); the route itself checks `settings.autoSyncEnabled` and a
  stored last-sync timestamp against `settings.autoSyncIntervalMinutes`
  before doing anything, so that setting can still space syncs out further
  than daily if you want. The client-side poll that keeps the
  Dashboard/Today screens fresh while you're actively looking at them is
  unrelated and unchanged.
- **Exports**: "Export today's prompts" and "Export all data" build their
  file content in memory and stream it straight back in the HTTP response —
  nothing is written to disk on the server, which matters on serverless
  where the filesystem isn't persistent.
