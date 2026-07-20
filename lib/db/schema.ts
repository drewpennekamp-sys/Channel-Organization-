import { pgTable, text, boolean, timestamp, integer, real } from 'drizzle-orm/pg-core';

export const channels = pgTable('channels', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  niche: text('niche').notNull(),
  owner: text('owner', { enum: ['you', 'friend'] }).notNull(),
  platformHandle: text('platform_handle'),
  videoGenTool: text('video_gen_tool').notNull(),
  needsVoiceover: boolean('needs_voiceover').notNull().default(false),
  voiceStyle: text('voice_style'),
  accentColor: text('accent_color').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const insights = pgTable('insights', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  date: timestamp('date', { mode: 'date' }).notNull().defaultNow(),
  summary: text('summary').notNull(),
  recommendations: text('recommendations').notNull().default('[]'),
  source: text('source', { enum: ['claude', 'manual'] })
    .notNull()
    .default('claude'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const dailyPlans = pgTable('daily_plans', {
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
  postedAt: timestamp('posted_at', { mode: 'date' }),
  informedByInsightId: text('informed_by_insight_id').references(() => insights.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

export const postedVideos = pgTable('posted_videos', {
  id: text('id').primaryKey(),
  channelId: text('channel_id')
    .notNull()
    .references(() => channels.id, { onDelete: 'cascade' }),
  dailyPlanId: text('daily_plan_id').references(() => dailyPlans.id, { onDelete: 'set null' }),
  ideaTitle: text('idea_title').notNull().default(''),
  platformVideoId: text('platform_video_id'),
  postedAt: timestamp('posted_at', { mode: 'date' }).notNull().defaultNow(),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares'),
  avgViewDuration: real('avg_view_duration'),
  retentionNote: text('retention_note'),
  lastSyncedAt: timestamp('last_synced_at', { mode: 'date' }),
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type Channel = typeof channels.$inferSelect;
export type NewChannel = typeof channels.$inferInsert;
export type DailyPlan = typeof dailyPlans.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type PostedVideo = typeof postedVideos.$inferSelect;
