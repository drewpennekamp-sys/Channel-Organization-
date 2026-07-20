import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// The Neon HTTP driver issues one stateless HTTP request per query instead of
// holding a TCP connection open, so it's inherently safe under serverless
// functions and cron invocations firing concurrently — there's no connection
// pool to exhaust. Point DATABASE_URL at Neon's pooled connection string
// regardless (it's still the recommended default for the underlying Postgres
// role limits).
type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

// Built lazily, on first real use, rather than at module load. Every route
// is force-dynamic so nothing should call this during a build, but Next
// still `require()`s route modules while collecting page data — evaluating
// this eagerly at import time would fail that step whenever DATABASE_URL
// isn't present at build time (e.g. it's only configured for the Runtime
// environment, or a preview deploy without it configured yet).
function getDb(): Db {
  if (cached) return cached;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Add it to your environment (see README) — it should be a Neon/Postgres connection string.'
    );
  }
  const sql = neon(process.env.DATABASE_URL);
  cached = drizzle(sql, { schema });
  return cached;
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
