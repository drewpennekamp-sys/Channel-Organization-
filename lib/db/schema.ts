import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const channels = sqliteTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  niche: text('niche').notNull(),
  owner: text('owner', { enum: ['you', 'friend'] }).notNull(),
  platformHandle: text('platform_handle'),
  videoGenTool: text('video_gen_tool').notNull(),
  needsVoiceover: integer('needs_voiceover', { mode: 'boolean' }).notNull().default(false),
  voiceStyle: text('voice_style'),
  accentColor: text('accent_color').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const dailyPlans = sqliteTable('daily_plans', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  ideaTitle: text('idea_title').notNull(),
  hook: text('hook'),
  videoPrompt: text('video_prompt'),
  voiceoverScript: text('voiceover_script'),
  postStatus: text('post_status', {
    enum: ['idea', 'scripted', 'rendering', 'scheduled', 'posted'],
  })
    .notNull()
    .default('idea'),
  postedAt: integer('posted_at', { mode: 'timestamp' }),
  informedByInsightId: text('informed_by_insight_id').references(() => insights.id, {
    onDelete: 'set null',
  }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const postedVideos = sqliteTable('posted_videos', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  dailyPlanId: text('daily_plan_id').references(() => dailyPlans.id, { onDelete: 'set null' }),
  ideaTitle: text('idea_title').notNull(),
  platformVideoId: text('platform_video_id'),
  postedAt: integer('posted_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares'),
  avgViewDuration: real('avg_view_duration'),
  retentionNote: text('retention_note'),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
});

export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  date: integer('date', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
  summary: text('summary').notNull(),
  recommendations: text('recommendations').notNull().default('[]'),
  source: text('source', { enum: ['claude', 'manual'] })
    .notNull()
    .default('claude'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type DailyPlan = typeof dailyPlans.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type PostedVideo = typeof postedVideos.$inferSelect;
