import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import * as schema from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'shorts-factory.db');

declare global {
  // eslint-disable-next-line no-var
  var __sfSqlite: Database.Database | undefined;
}

function createConnection() {
  const fs = require('node:fs') as typeof import('node:fs');
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      niche TEXT NOT NULL,
      owner TEXT NOT NULL,
      platform_handle TEXT,
      video_gen_tool TEXT NOT NULL,
      needs_voiceover INTEGER NOT NULL DEFAULT 0,
      voice_style TEXT,
      accent_color TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      idea_title TEXT NOT NULL,
      post_status TEXT NOT NULL DEFAULT 'idea',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      summary TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const defaultToolStmt = sqlite.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_video_gen_tool', ?)`
  );
  defaultToolStmt.run('InVideo');

  return sqlite;
}

const sqlite = global.__sfSqlite ?? createConnection();
if (process.env.NODE_ENV !== 'production') global.__sfSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
