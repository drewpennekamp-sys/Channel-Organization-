# AI Agency OS

A minimal CRM/pipeline tool for running a $0-cost, AI-assisted web-design
agency: store prospects, audit their web presence, draft personalized
outreach, and track everything through a sales pipeline — up through
turning a won prospect into a client with tracked projects.

This is Phase 1: get to **10 audited HVAC prospects → personalized outreach
→ one interested reply → one paying client.** It is deliberately not
automated yet — you approve every audit and every outreach message by
hand. Automate later, once the workflow is proven.

## Stack

- Next.js 14 (App Router, Server Actions — most "buttons" in this app are
  Server Actions, not API routes, which keeps the code smaller)
- Supabase (Postgres) — accessed only from the server, via the
  `service_role` key
- Tailwind for styling
- `jose` for a simple shared-password login (see "Why no Supabase Auth?"
  below)
- No Anthropic API key required. See "How the AI audit works" below.

## Why no Supabase Auth?

Supabase Auth (magic links, OAuth, etc.) is built for apps with multiple
end users. Right now there's exactly one user: you. A shared password
behind a signed session cookie (same pattern, ~40 lines of code) gets you
the same practical protection — nobody without the password can see your
prospect list — with far less setup. If you ever bring on a partner or
outsource outreach, swapping this for real Supabase Auth is a contained
change (just `lib/auth.ts` + `middleware.ts`), not a rewrite.

## How the AI audit works (and why it costs $0)

The "AI Auditor" is a prompt template (`lib/audit.ts`), not a wired-up API
call. On a prospect's page:

1. Click to reveal the audit prompt, pre-filled with that business's name,
   website (or a note that they have none), and your research notes.
2. Copy it into Claude — claude.ai, or a Claude Code chat, whatever you
   already have access to.
3. Claude answers with a strict JSON block: an overall score, top 5
   problems, recommended fixes, a sales angle, and a draft outreach email.
4. Paste that JSON back into the form under the prompt. The app validates
   it and saves it as an audit record, and mirrors the score/problems/pitch
   onto the prospect for the list view.

This keeps the whole loop free — it rides on the Claude Code / claude.ai
access you already pay for, instead of a metered `ANTHROPIC_API_KEY` in the
deployed app. Once you have paying clients and want this to run
automatically overnight, that's the natural next upgrade (swap the
copy/paste step for a real API call in a cron job) — a config change, not a
redesign, because the prompt and the JSON shape are already defined.

The same pattern powers the outreach section: an "alternate draft" prompt
(`lib/outreach.ts`) if the audit's first draft doesn't feel right.

## No auto-sending, ever (in this phase)

Outreach messages are stored as drafts. Marking one **approved** just flips
a flag — it does not send anything. You still copy the message into your
own email client and send it yourself; "Mark as sent by me" only records
that you did, and the app refuses to let you mark something sent that
hasn't been approved first. This matches the brief: no automatic
spamming, and a hard `approved = true` gate is baked into the database and
the code before any future send-automation could be added.

## Setup

1. **Create a free Supabase project** at supabase.com if you don't have one.
2. **Run the schema.** Supabase dashboard → SQL Editor → paste the contents
   of `db/schema.sql` → Run.
3. **Get your keys.** Supabase dashboard → Project Settings → API. You need
   the Project URL and the `service_role` secret key (not the `anon` key).
4. **Set environment variables.** Copy `.env.local.example` to `.env.local`
   and fill in:

   | Variable | Where it's used |
   |---|---|
   | `SUPABASE_URL` | Server-side Supabase client (`lib/supabase.ts`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Same — bypasses Row Level Security, server-only |
   | `AUTH_PASSWORD` | The password you'll type in at `/login` |
   | `AUTH_SECRET` | Signs the session cookie — any long random string, e.g. `openssl rand -base64 32` |

5. **Install and run:**
   ```bash
   npm install
   npm run seed   # optional: adds 5 sample prospects so you can click around
   npm run dev
   ```
6. Visit `http://localhost:3000`, sign in with `AUTH_PASSWORD`.

## Deploying to Vercel

1. Import this repo in Vercel.
2. Add the same four environment variables in Vercel → Settings →
   Environment Variables (Production + Preview).
3. Deploy.

Supabase's free tier and Vercel's Hobby tier cover this comfortably at the
volumes Phase 1 needs (a few dozen prospects, a handful of clients).

## What's here vs. what's next

Built now: prospect CRM, search/filter, the pipeline dashboard, the audit
workflow, the outreach draft/approve workflow, and a minimal
client/project tracker for once you've won someone.

Deliberately not built yet (per the brief — validate first, automate
later): automatic prospect discovery/scraping, automatic email sending,
demo site generation. Once you've closed your first client by hand, the
natural next additions are: a script to help surface HVAC businesses with
weak web presence in a given city (still respecting sites' terms — no
scraping personal data), and a `demo_url` field on `projects` you already
have a place to put a Lovable-generated preview link once you're ready to
build one.

## Project structure

```
app/
  actions.ts              # All Server Actions (create/update prospects, audits, outreach, clients, projects)
  dashboard/               # Pipeline overview
  prospects/               # List (search/filter), new, [id] detail (audit + outreach)
  clients/                 # List, new, [id] detail (projects)
  login/, api/auth/        # Shared-password auth
db/schema.sql              # Full Postgres schema — run this in Supabase
lib/
  supabase.ts              # Server-only Supabase client (service_role)
  audit.ts                 # Audit prompt builder + Zod schema for the AI's JSON response
  outreach.ts              # Alternate-outreach prompt builder
  validation.ts            # Zod schemas for all forms
  status.ts, types.ts      # Pipeline statuses, colors, shared TS types
scripts/seed.ts            # Sample data for local testing
```
