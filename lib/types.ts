import type { ProspectStatus } from './status';

export interface Prospect {
  id: string;
  business_name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  niche: string;
  website_score: number | null;
  problems_found: string[];
  opportunity: string | null;
  personalized_pitch: string | null;
  status: ProspectStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  prospect_id: string;
  overall_score: number;
  top_problems: string[];
  recommended_improvements: string[];
  sales_angle: string | null;
  outreach_subject: string | null;
  outreach_draft: string | null;
  raw_response: unknown;
  created_at: string;
}

export type OutreachChannel = 'email' | 'phone' | 'sms' | 'other';
export type OutreachStatus = 'draft' | 'approved' | 'sent' | 'replied';

export interface Outreach {
  id: string;
  prospect_id: string;
  audit_id: string | null;
  channel: OutreachChannel;
  subject: string | null;
  message: string;
  approved: boolean;
  status: OutreachStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientStatus = 'active' | 'paused' | 'churned';

export interface Client {
  id: string;
  prospect_id: string | null;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectType = 'website' | 'lead-gen' | 'quote-system' | 'other';
export type ProjectStatus = 'planning' | 'in_progress' | 'review' | 'delivered' | 'maintenance';

export interface Project {
  id: string;
  client_id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  demo_url: string | null;
  live_url: string | null;
  price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
