'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/supabase';
import { AuditResultSchema } from '@/lib/audit';
import {
  NewClientSchema,
  NewOutreachSchema,
  NewProjectSchema,
  NewProspectSchema,
  ProspectStatusSchema,
} from '@/lib/validation';
import { isProspectStatus } from '@/lib/status';

function formValues(formData: FormData) {
  return Object.fromEntries(formData.entries()) as Record<string, string>;
}

// ---------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------

export async function createProspect(formData: FormData) {
  const parsed = NewProspectSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirect(`/prospects/new?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const db = getDb();
  const { data, error } = await db
    .from('prospects')
    .insert({ ...parsed.data, niche: parsed.data.niche || 'HVAC' })
    .select('id')
    .single();

  if (error) throw error;

  revalidatePath('/prospects');
  revalidatePath('/dashboard');
  redirect(`/prospects/${data.id}`);
}

export async function updateProspectStatus(prospectId: string, formData: FormData) {
  const status = formData.get('status');
  if (typeof status !== 'string' || !isProspectStatus(status)) {
    throw new Error('Invalid status');
  }
  ProspectStatusSchema.parse(status);

  const db = getDb();
  const { error } = await db.from('prospects').update({ status }).eq('id', prospectId);
  if (error) throw error;

  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath('/prospects');
  revalidatePath('/dashboard');
}

export async function updateProspectNotes(prospectId: string, formData: FormData) {
  const notes = formData.get('notes');
  const db = getDb();
  const { error } = await db
    .from('prospects')
    .update({ notes: typeof notes === 'string' ? notes : null })
    .eq('id', prospectId);
  if (error) throw error;

  revalidatePath(`/prospects/${prospectId}`);
}

export async function deleteProspect(prospectId: string, formData: FormData) {
  const db = getDb();
  const { error } = await db.from('prospects').delete().eq('id', prospectId);
  if (error) throw error;

  revalidatePath('/prospects');
  revalidatePath('/dashboard');
  redirect('/prospects');
}

// ---------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------

export async function saveAuditFromPaste(prospectId: string, formData: FormData) {
  const raw = formData.get('audit_json');
  if (typeof raw !== 'string' || !raw.trim()) {
    redirect(`/prospects/${prospectId}?auditError=${encodeURIComponent('Paste the AI response first.')}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(raw as string);
  } catch {
    redirect(
      `/prospects/${prospectId}?auditError=${encodeURIComponent(
        "That wasn't valid JSON — make sure you copied the whole response, including the { }."
      )}`
    );
  }

  const parsed = AuditResultSchema.safeParse(json);
  if (!parsed.success) {
    redirect(
      `/prospects/${prospectId}?auditError=${encodeURIComponent(
        `Response didn't match the expected shape: ${parsed.error.issues[0].message}`
      )}`
    );
    return;
  }

  const result = parsed.data;
  const db = getDb();

  const { data: audit, error: auditError } = await db
    .from('audits')
    .insert({
      prospect_id: prospectId,
      overall_score: result.overall_score,
      top_problems: result.top_problems,
      recommended_improvements: result.recommended_improvements,
      sales_angle: result.sales_angle,
      outreach_subject: result.outreach_subject,
      outreach_draft: result.outreach_message,
      raw_response: result,
    })
    .select('id')
    .single();

  if (auditError) throw auditError;

  const { data: current } = await db
    .from('prospects')
    .select('status')
    .eq('id', prospectId)
    .single();

  const nextStatus =
    current && (current.status === 'New' || current.status === 'Researching')
      ? 'Audited'
      : current?.status;

  const { error: prospectError } = await db
    .from('prospects')
    .update({
      website_score: result.overall_score,
      problems_found: result.top_problems,
      opportunity: result.sales_angle,
      personalized_pitch: result.outreach_message,
      ...(nextStatus ? { status: nextStatus } : {}),
    })
    .eq('id', prospectId);

  if (prospectError) throw prospectError;

  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath('/prospects');
  revalidatePath('/dashboard');
  redirect(`/prospects/${prospectId}?auditSaved=1`);
}

// ---------------------------------------------------------------------
// Outreach
// ---------------------------------------------------------------------

export async function saveOutreachDraft(prospectId: string, formData: FormData) {
  const parsed = NewOutreachSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirect(
      `/prospects/${prospectId}?outreachError=${encodeURIComponent(parsed.error.issues[0].message)}`
    );
  }

  const db = getDb();
  const { error } = await db.from('outreach').insert({
    prospect_id: prospectId,
    ...parsed.data,
  });
  if (error) throw error;

  revalidatePath(`/prospects/${prospectId}`);
  redirect(`/prospects/${prospectId}?outreachSaved=1`);
}

export async function setOutreachApproval(prospectId: string, outreachId: string, formData: FormData) {
  const approved = formData.get('approved') === 'true';
  const db = getDb();
  const { error } = await db
    .from('outreach')
    .update({ approved, status: approved ? 'approved' : 'draft' })
    .eq('id', outreachId);
  if (error) throw error;

  revalidatePath(`/prospects/${prospectId}`);
}

// Only marks a message as sent AFTER you've personally approved it and sent
// it yourself (email client, phone call, etc.) — this app never sends
// anything on its own. Refuses to record "sent" on an unapproved draft,
// mirroring the same rule a future send-automation would have to obey.
export async function markOutreachSent(prospectId: string, outreachId: string) {
  const db = getDb();
  const { data: outreach, error: fetchError } = await db
    .from('outreach')
    .select('approved')
    .eq('id', outreachId)
    .single();
  if (fetchError) throw fetchError;
  if (!outreach?.approved) {
    throw new Error('Approve this message before marking it sent.');
  }

  const { error } = await db
    .from('outreach')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', outreachId);
  if (error) throw error;

  const { error: prospectError } = await db
    .from('prospects')
    .update({ status: 'Contacted' })
    .eq('id', prospectId)
    .in('status', ['New', 'Researching', 'Audited']);
  if (prospectError) throw prospectError;

  revalidatePath(`/prospects/${prospectId}`);
  revalidatePath('/prospects');
  revalidatePath('/dashboard');
}

// ---------------------------------------------------------------------
// Clients & projects
// ---------------------------------------------------------------------

export async function createClientFromProspect(prospectId: string) {
  const db = getDb();
  const { data: prospect, error: fetchError } = await db
    .from('prospects')
    .select('business_name, email, phone')
    .eq('id', prospectId)
    .single();
  if (fetchError) throw fetchError;

  const { data: client, error } = await db
    .from('clients')
    .insert({
      prospect_id: prospectId,
      business_name: prospect.business_name,
      email: prospect.email,
      phone: prospect.phone,
    })
    .select('id')
    .single();
  if (error) throw error;

  await db.from('prospects').update({ status: 'Won' }).eq('id', prospectId);

  revalidatePath('/clients');
  revalidatePath('/prospects');
  revalidatePath('/dashboard');
  redirect(`/clients/${client.id}`);
}

export async function createClient(formData: FormData) {
  const parsed = NewClientSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirect(`/clients/new?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const db = getDb();
  const { data, error } = await db.from('clients').insert(parsed.data).select('id').single();
  if (error) throw error;

  revalidatePath('/clients');
  redirect(`/clients/${data.id}`);
}

export async function createProject(clientId: string, formData: FormData) {
  const parsed = NewProjectSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    redirect(`/clients/${clientId}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  }

  const db = getDb();
  const { error } = await db.from('projects').insert({ client_id: clientId, ...parsed.data });
  if (error) throw error;

  revalidatePath(`/clients/${clientId}`);
}
