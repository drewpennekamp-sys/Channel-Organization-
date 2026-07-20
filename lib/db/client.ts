import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// The Neon HTTP driver issues one stateless HTTP request per query instead of
// holding a TCP connection open, so it's inherently safe under serverless
// functions and cron invocations firing concurrently — there's no connection
// pool to exhaust. Point DATABASE_URL at Neon's pooled connection string
// regardless (it's still the recommended default for the underlying Postgres
// role limits).
//
// Every route is force-dynamic, so nothing should ever run a real query
// during `next build` — but Next still `require()`s each route module while
// collecting page data, which evaluates this file. NEXT_PHASE is set by
// Next.js itself during that build step, so a placeholder connection string
// there satisfies neon()'s "give me a non-empty string" check without ever
// being used to actually connect. At real request time, a genuinely missing
// DATABASE_URL throws immediately and clearly instead of a placeholder
// masking it.
const connectionString =
  process.env.DATABASE_URL ??
  (process.env.NEXT_PHASE === 'phase-production-build'
    ? 'postgres://build:build@localhost:5432/build'
    : undefined);

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your environment (see README) — it should be a Neon/Postgres connection string.'
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, { schema });
