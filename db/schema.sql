-- AI Agency OS — Supabase schema
--
-- Run this once in Supabase → SQL Editor (or `supabase db push` if you use
-- the CLI). Safe to re-run: every statement is guarded with IF NOT EXISTS /
-- OR REPLACE, except the CREATE TABLE bodies themselves — if you need to
-- re-run after editing a table, drop it first.
--
-- Security model: every table has Row Level Security enabled and NO
-- policies. That means the anon/public API key (the one safe to put in a
-- browser) gets zero access — reads and writes only happen through the
-- server, using the service_role key, which bypasses RLS entirely. This app
-- never calls Supabase from the browser, so this is the correct default:
-- your data isn't reachable just because someone has your project URL.

create extension if not exists pgcrypto;

-- Shared trigger: stamps updated_at on every UPDATE. Reused by prospects,
-- outreach, clients, and projects.
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- prospects — every local business you're evaluating or pursuing.
-- ---------------------------------------------------------------------
create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),

  business_name text not null,
  website text,
  phone text,
  email text,
  city text,
  niche text not null default 'HVAC',

  -- Filled in once an audit runs (see `audits` below for full history —
  -- these columns always mirror the latest audit for fast list/filter views).
  website_score integer check (website_score between 0 and 100),
  problems_found jsonb not null default '[]'::jsonb,
  opportunity text,
  personalized_pitch text,

  status text not null default 'New' check (status in (
    'New', 'Researching', 'Audited', 'Contacted', 'Replied',
    'Demo Requested', 'Demo Sent', 'Call', 'Won', 'Lost'
  )),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospects_status_idx on prospects (status);
create index if not exists prospects_niche_idx on prospects (niche);
create index if not exists prospects_city_idx on prospects (city);

drop trigger if exists prospects_set_updated_at on prospects;
create trigger prospects_set_updated_at
  before update on prospects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- audits — one row per AI audit run against a prospect. Kept as an
-- immutable history even though `prospects` mirrors the latest one.
-- ---------------------------------------------------------------------
create table if not exists audits (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,

  overall_score integer not null check (overall_score between 0 and 100),
  top_problems jsonb not null default '[]'::jsonb,
  recommended_improvements jsonb not null default '[]'::jsonb,
  sales_angle text,
  outreach_subject text,
  outreach_draft text,

  -- Full raw AI response, kept for reference/debugging.
  raw_response jsonb,

  created_at timestamptz not null default now()
);

create index if not exists audits_prospect_id_idx on audits (prospect_id);

-- ---------------------------------------------------------------------
-- outreach — every outreach message drafted for a prospect. Nothing in
-- this app sends these automatically; `approved` and `sent_at` exist so a
-- future send-automation has a hard gate: never send unless approved=true.
-- ---------------------------------------------------------------------
create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid not null references prospects(id) on delete cascade,
  audit_id uuid references audits(id) on delete set null,

  channel text not null default 'email' check (channel in ('email', 'phone', 'sms', 'other')),
  subject text,
  message text not null,

  approved boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'approved', 'sent', 'replied')),
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outreach_prospect_id_idx on outreach (prospect_id);

drop trigger if exists outreach_set_updated_at on outreach;
create trigger outreach_set_updated_at
  before update on outreach
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- clients — prospects that said yes. Usually created from a Won prospect,
-- but client_id is nullable so you can add a client by hand too.
-- ---------------------------------------------------------------------
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references prospects(id) on delete set null,

  business_name text not null,
  contact_name text,
  email text,
  phone text,
  status text not null default 'active' check (status in ('active', 'paused', 'churned')),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clients_prospect_id_idx on clients (prospect_id);

drop trigger if exists clients_set_updated_at on clients;
create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- projects — the actual deliverable(s) for a client (website, lead-gen
-- system, quote system, ...). One client can have several over time.
-- ---------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,

  name text not null,
  type text not null default 'website' check (type in ('website', 'lead-gen', 'quote-system', 'other')),
  status text not null default 'planning' check (status in (
    'planning', 'in_progress', 'review', 'delivered', 'maintenance'
  )),
  demo_url text,
  live_url text,
  price numeric(10, 2),
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_client_id_idx on projects (client_id);

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security — enabled, no policies. See the note at the top.
-- ---------------------------------------------------------------------
alter table prospects enable row level security;
alter table audits enable row level security;
alter table outreach enable row level security;
alter table clients enable row level security;
alter table projects enable row level security;
