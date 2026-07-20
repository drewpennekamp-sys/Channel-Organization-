import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// The Neon HTTP driver issues one stateless HTTP request per query instead of
// holding a TCP connection open, so it's inherently safe under serverless
// functions and cron invocations firing concurrently — there's no connection
// pool to exhaust. Point DATABASE_URL at Neon's pooled connection string
// regardless (it's still the recommended default for the underlying Postgres
// role limits).
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Add it to your environment (see README) — it should be a Neon/Postgres connection string.'
  );
}

const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema });
