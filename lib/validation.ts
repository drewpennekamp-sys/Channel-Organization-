import { z } from 'zod';
import { PIPELINE_STATUSES } from './status';

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

export const NewProspectSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  website: z.preprocess(emptyToUndefined, z.string().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  city: z.preprocess(emptyToUndefined, z.string().optional()),
  niche: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
});

export const ProspectStatusSchema = z.enum(PIPELINE_STATUSES);

export const NewOutreachSchema = z.object({
  channel: z.enum(['email', 'phone', 'sms', 'other']),
  subject: z.preprocess(emptyToUndefined, z.string().optional()),
  message: z.string().min(1, 'Message is required'),
  audit_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const NewClientSchema = z.object({
  business_name: z.string().min(1, 'Business name is required'),
  contact_name: z.preprocess(emptyToUndefined, z.string().optional()),
  email: z.preprocess(emptyToUndefined, z.string().email().optional()),
  phone: z.preprocess(emptyToUndefined, z.string().optional()),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
  prospect_id: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
});

export const NewProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  type: z.enum(['website', 'lead-gen', 'quote-system', 'other']),
  status: z.enum(['planning', 'in_progress', 'review', 'delivered', 'maintenance']),
  demo_url: z.preprocess(emptyToUndefined, z.string().optional()),
  live_url: z.preprocess(emptyToUndefined, z.string().optional()),
  price: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.coerce.number().nonnegative().optional()
  ),
  notes: z.preprocess(emptyToUndefined, z.string().optional()),
});
