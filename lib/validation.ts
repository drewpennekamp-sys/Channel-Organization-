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

export const manualInsightSchema = z.object({
  summary: z.string().trim().min(1, 'Summary is required').max(500, 'Keep it under 500 characters'),
  recommendations: z
    .array(z.string().trim().min(1).max(200, 'Keep each recommendation under 200 characters'))
    .max(6, 'Keep it to 6 recommendations or fewer'),
});

export type ManualInsightInput = z.infer<typeof manualInsightSchema>;
