import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

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
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const postedVideos = sqliteTable('posted_videos', {
  id: text('id').primaryKey(),
  dailyPlanId: text('daily_plan_id')
    .notNull()
    .references(() => dailyPlans.id, { onDelete: 'cascade' }),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  postedAt: integer('posted_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const insights = sqliteTable('insights', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  summary: text('summary').notNull(),
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
