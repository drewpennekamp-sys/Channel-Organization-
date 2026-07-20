import { z } from 'zod';

export const channelInputSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Keep it under 80 characters'),
  niche: z.string().trim().min(1, 'Niche is required').max(140, 'Keep it under 140 characters'),
  owner: z.enum(['you', 'friend'], { errorMap: () => ({ message: 'Choose an owner' }) }),
  platformHandle: z.string().trim().max(120).optional().nullable(),
  videoGenTool: z.string().trim().min(1, 'Video-gen tool is required'),
  needsVoiceover: z.boolean(),
  voiceStyle: z.string().trim().max(280).optional().nullable(),
});

export type ChannelInput = z.infer<typeof channelInputSchema>;

export const markPostedSchema = z.object({
  views: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  likes: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  comments: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
});

export type MarkPostedInput = z.infer<typeof markPostedSchema>;

export const videoInputSchema = z.object({
  ideaTitle: z.string().trim().min(1, 'Title is required').max(160, 'Keep it under 160 characters'),
  postedAt: z
    .string()
    .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Enter a valid date'),
  views: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  likes: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  comments: z.number().int('Must be a whole number').min(0, 'Must be 0 or more'),
  shares: z.number().int('Must be a whole number').min(0, 'Must be 0 or more').optional().nullable(),
  avgViewDuration: z.number().min(0, 'Must be 0 or more').optional().nullable(),
  retentionNote: z.string().trim().max(500, 'Keep it under 500 characters').optional().nullable(),
});

export type VideoInput = z.infer<typeof videoInputSchema>;

export const videoUpdateSchema = videoInputSchema.partial();

export type VideoUpdateInput = z.infer<typeof videoUpdateSchema>;

export const settingsInputSchema = z
  .object({
    defaultVideoGenTool: z
      .string()
      .trim()
      .min(1, 'Default video-gen tool is required')
      .max(80, 'Keep it under 80 characters'),
    defaultPostingTarget: z
      .number()
      .int('Must be a whole number')
      .min(1, 'Must be at least 1 post/day')
      .max(20, 'Keep it under 20 posts/day'),
    defaultNeedsVoiceover: z.boolean(),
    autoSyncEnabled: z.boolean(),
    autoSyncIntervalMinutes: z
      .number()
      .int('Must be a whole number')
      .min(5, 'Must be at least 5 minutes')
      .max(1440, 'Must be a day or less'),
    pollIntervalSeconds: z
      .number()
      .int('Must be a whole number')
      .min(5, 'Must be at least 5 seconds')
      .max(600, 'Must be 10 minutes or less'),
  })
  .partial();

export type SettingsInput = z.infer<typeof settingsInputSchema>;

const importChannelSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  niche: z.string(),
  owner: z.enum(['you', 'friend']),
  platformHandle: z.string().nullable(),
  videoGenTool: z.string(),
  needsVoiceover: z.boolean(),
  voiceStyle: z.string().nullable(),
  accentColor: z.string(),
  createdAt: z.string(),
});

const importInsightSchema = z.object({
  id: z.string().min(1),
  channelId: z.string().min(1),
  date: z.string(),
  summary: z.string(),
  recommendations: z.array(z.string()),
  source: z.enum(['claude', 'manual']),
  createdAt: z.string(),
});

const importDailyPlanSchema = z.object({
  id: z.string().min(1),
  channelId: z.string().min(1),
  ideaTitle: z.string(),
  hook: z.string().nullable(),
  videoPrompt: z.string().nullable(),
  voiceoverScript: z.string().nullable(),
  postStatus: z.enum(['idea', 'scripted', 'rendering', 'scheduled', 'posted']),
  postedAt: z.string().nullable(),
  informedByInsightId: z.string().nullable(),
  informedByInsightDate: z.string().nullable().optional(),
  createdAt: z.string(),
});

const importPostedVideoSchema = z.object({
  id: z.string().min(1),
  channelId: z.string().min(1),
  dailyPlanId: z.string().nullable(),
  ideaTitle: z.string(),
  platformVideoId: z.string().nullable(),
  postedAt: z.string(),
  views: z.number().int(),
  likes: z.number().int(),
  comments: z.number().int(),
  shares: z.number().int().nullable(),
  avgViewDuration: z.number().nullable(),
  retentionNote: z.string().nullable(),
  lastSyncedAt: z.string().nullable(),
});

const importSettingsSchema = z.object({
  defaultVideoGenTool: z.string(),
  defaultPostingTarget: z.number(),
  defaultNeedsVoiceover: z.boolean(),
  autoSyncEnabled: z.boolean(),
  autoSyncIntervalMinutes: z.number(),
  pollIntervalSeconds: z.number(),
});

export const importDataSchema = z.object({
  exportedAt: z.string(),
  channels: z.array(importChannelSchema),
  insights: z.array(importInsightSchema),
  dailyPlans: z.array(importDailyPlanSchema),
  postedVideos: z.array(importPostedVideoSchema),
  settings: importSettingsSchema,
});

export type ImportDataInput = z.infer<typeof importDataSchema>;

export const manualInsightSchema = z.object({
  summary: z.string().trim().min(1, 'Summary is required').max(500, 'Keep it under 500 characters'),
  recommendations: z
    .array(z.string().trim().min(1).max(200, 'Keep each recommendation under 200 characters'))
    .max(6, 'Keep it to 6 recommendations or fewer'),
});

export type ManualInsightInput = z.infer<typeof manualInsightSchema>;
