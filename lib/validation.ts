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
