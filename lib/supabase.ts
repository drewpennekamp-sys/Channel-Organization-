import { createClient } from '@supabase/supabase-js';

// Server-only client, authenticated with the service_role key. Never import
// this from a 'use client' file — the service_role key bypasses Row Level
// Security, so it must stay on the server (Route Handlers, Server
// Components, Server Actions).
export function getDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set. Add them to your environment (see README).'
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
