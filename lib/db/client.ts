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

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      date INTEGER NOT NULL DEFAULT (unixepoch()),
      summary TEXT NOT NULL,
      recommendations TEXT NOT NULL DEFAULT '[]',
      source TEXT NOT NULL DEFAULT 'claude',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS daily_plans (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      idea_title TEXT NOT NULL,
      hook TEXT,
      video_prompt TEXT,
      voiceover_script TEXT,
      post_status TEXT NOT NULL DEFAULT 'idea',
      posted_at INTEGER,
      informed_by_insight_id TEXT REFERENCES insights(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS posted_videos (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
      daily_plan_id TEXT REFERENCES daily_plans(id) ON DELETE SET NULL,
      idea_title TEXT NOT NULL DEFAULT '',
      platform_video_id TEXT,
      posted_at INTEGER NOT NULL DEFAULT (unixepoch()),
      views INTEGER NOT NULL DEFAULT 0,
      likes INTEGER NOT NULL DEFAULT 0,
      comments INTEGER NOT NULL DEFAULT 0,
      shares INTEGER,
      avg_view_duration REAL,
      retention_note TEXT,
      last_synced_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const insightColumns = new Set(
    (sqlite.pragma('table_info(insights)') as Array<{ name: string }>).map((c) => c.name)
  );
  for (const [column, ddl] of Object.entries({
    date: 'ALTER TABLE insights ADD COLUMN date INTEGER NOT NULL DEFAULT (unixepoch())',
    recommendations: "ALTER TABLE insights ADD COLUMN recommendations TEXT NOT NULL DEFAULT '[]'",
    source: "ALTER TABLE insights ADD COLUMN source TEXT NOT NULL DEFAULT 'claude'",
  })) {
    if (!insightColumns.has(column)) sqlite.exec(ddl);
  }

  const dailyPlanColumns = new Set(
    (sqlite.pragma('table_info(daily_plans)') as Array<{ name: string }>).map((c) => c.name)
  );
  for (const [column, ddl] of Object.entries({
    hook: 'ALTER TABLE daily_plans ADD COLUMN hook TEXT',
    video_prompt: 'ALTER TABLE daily_plans ADD COLUMN video_prompt TEXT',
    voiceover_script: 'ALTER TABLE daily_plans ADD COLUMN voiceover_script TEXT',
    posted_at: 'ALTER TABLE daily_plans ADD COLUMN posted_at INTEGER',
    informed_by_insight_id: 'ALTER TABLE daily_plans ADD COLUMN informed_by_insight_id TEXT REFERENCES insights(id) ON DELETE SET NULL',
  })) {
    if (!dailyPlanColumns.has(column)) sqlite.exec(ddl);
  }

  const postedVideoColumns = new Set(
    (sqlite.pragma('table_info(posted_videos)') as Array<{ name: string }>).map((c) => c.name)
  );
  for (const [column, ddl] of Object.entries({
    idea_title: "ALTER TABLE posted_videos ADD COLUMN idea_title TEXT NOT NULL DEFAULT ''",
    platform_video_id: 'ALTER TABLE posted_videos ADD COLUMN platform_video_id TEXT',
    shares: 'ALTER TABLE posted_videos ADD COLUMN shares INTEGER',
    avg_view_duration: 'ALTER TABLE posted_videos ADD COLUMN avg_view_duration REAL',
    retention_note: 'ALTER TABLE posted_videos ADD COLUMN retention_note TEXT',
    last_synced_at: 'ALTER TABLE posted_videos ADD COLUMN last_synced_at INTEGER',
  })) {
    if (!postedVideoColumns.has(column)) sqlite.exec(ddl);
  }

  const defaultToolStmt = sqlite.prepare(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('default_video_gen_tool', ?)`
  );
  defaultToolStmt.run('InVideo');

  return sqlite;
}

const sqlite = global.__sfSqlite ?? createConnection();
if (process.env.NODE_ENV !== 'production') global.__sfSqlite = sqlite;

export const db = drizzle(sqlite, { schema });
