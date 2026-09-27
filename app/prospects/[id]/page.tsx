import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NavHeader } from '@/components/NavHeader';
import { StatusBadge } from '@/components/Badge';
import { CopyButton } from '@/components/CopyButton';
import { StatusSelect } from '@/components/StatusSelect';
import { ConfirmSubmitButton } from '@/components/ConfirmSubmitButton';
import { getDb } from '@/lib/supabase';
import { buildAuditPrompt } from '@/lib/audit';
import { buildAlternateOutreachPrompt } from '@/lib/outreach';
import {
  createClientFromProspect,
  deleteProspect,
  markOutreachSent,
  saveAuditFromPaste,
  saveOutreachDraft,
  setOutreachApproval,
  updateProspectNotes,
  updateProspectStatus,
} from '@/app/actions';
import type { Audit, Outreach, Prospect } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function loadProspect(id: string) {
  const db = getDb();

  const { data: prospect, error } = await db.from('prospects').select('*').eq('id', id).single();
  if (error || !prospect) return null;

  const { data: audits } = await db
    .from('audits')
    .select('*')
    .eq('prospect_id', id)
    .order('created_at', { ascending: false });

  const { data: outreach } = await db
    .from('outreach')
    .select('*')
    .eq('prospect_id', id)
    .order('created_at', { ascending: false });

  return {
    prospect: prospect as Prospect,
    audits: (audits ?? []) as Audit[],
    outreach: (outreach ?? []) as Outreach[],
  };
}

const OUTREACH_STATUS_COLORS: Record<Outreach['status'], string> = {
  draft: 'bg-slate-100 text-slate-700',
  approved: 'bg-amber-100 text-amber-700',
  sent: 'bg-blue-100 text-blue-700',
  replied: 'bg-green-100 text-green-700',
};

export default async function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { auditError?: string; auditSaved?: string; outreachError?: string; outreachSaved?: string };
}) {
  const data = await loadProspect(params.id);
  if (!data) notFound();

  const { prospect, audits, outreach } = data;
  const latestAudit = audits[0];
  const auditPrompt = buildAuditPrompt(prospect);
  const altOutreachPrompt = latestAudit ? buildAlternateOutreachPrompt(prospect, latestAudit) : null;

  const boundUpdateStatus = updateProspectStatus.bind(null, prospect.id);
  const boundUpdateNotes = updateProspectNotes.bind(null, prospect.id);
  const boundSaveAudit = saveAuditFromPaste.bind(null, prospect.id);
  const boundSaveOutreach = saveOutreachDraft.bind(null, prospect.id);
  const boundCreateClient = createClientFromProspect.bind(null, prospect.id);
  const boundDelete = deleteProspect.bind(null, prospect.id);

  return (
    <div>
      <NavHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/prospects" className="mb-4 inline-block text-sm text-slate-500 hover:text-ink">
          &larr; All prospects
        </Link>

        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <h1 className="text-xl font-semibold">{prospect.business_name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {prospect.niche} &middot; {prospect.city ?? 'city unknown'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>
                Website:{' '}
                {prospect.website ? (
                  <a href={prospect.website} target="_blank" rel="noreferrer" className="text-ink underline">
                    {prospect.website}
                  </a>
                ) : (
                  <span className="text-red-500">none</span>
                )}
              </span>
              {prospect.phone && <span>Phone: {prospect.phone}</span>}
              {prospect.email && <span>Email: {prospect.email}</span>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StatusSelect action={boundUpdateStatus} current={prospect.status} />
            {prospect.website_score !== null && (
              <span className="text-sm text-slate-500">Score: {prospect.website_score}/100</span>
            )}
          </div>
        </div>

        {prospect.status === 'Won' && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-800">Marked Won — turn this into a client record.</p>
            <form action={boundCreateClient}>
              <button
                type="submit"
                className="rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-800"
              >
                Create client
              </button>
            </form>
          </div>
        )}

        {/* Notes */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Notes</h2>
          <form action={boundUpdateNotes} className="flex flex-col gap-2">
            <textarea
              name="notes"
              rows={3}
              defaultValue={prospect.notes ?? ''}
              placeholder="Research notes, call notes, anything relevant..."
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="self-end rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Save notes
            </button>
          </form>
        </section>

        {/* Audit */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Website audit</h2>

          {searchParams.auditError && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.auditError}
            </p>
          )}
          {searchParams.auditSaved && (
            <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">Audit saved.</p>
          )}

          {latestAudit ? (
            <div className="mb-5 space-y-3 rounded-md bg-slate-50 p-4 text-sm">
              <p className="font-medium">
                Overall score: {latestAudit.overall_score}/100
                <span className="ml-2 text-xs font-normal text-slate-400">
                  audited {new Date(latestAudit.created_at).toLocaleDateString()}
                </span>
              </p>
              <div>
                <p className="mb-1 font-medium">Top problems</p>
                <ul className="list-inside list-disc space-y-0.5 text-slate-700">
                  {latestAudit.top_problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 font-medium">Recommended improvements</p>
                <ul className="list-inside list-disc space-y-0.5 text-slate-700">
                  {latestAudit.recommended_improvements.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              {latestAudit.sales_angle && (
                <div>
                  <p className="mb-1 font-medium">Sales angle</p>
                  <p className="text-slate-700">{latestAudit.sales_angle}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="mb-5 text-sm text-slate-500">No audit yet.</p>
          )}

          <details className="group">
            <summary className="cursor-pointer text-sm font-medium text-ink">
              {latestAudit ? 'Re-run audit' : 'Step 1 — Generate audit prompt'}
            </summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs text-slate-500">
                Copy this into Claude (claude.ai or Claude Code) and run it. Then paste the JSON it
                gives back below.
              </p>
              <div className="relative">
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                  {auditPrompt}
                </pre>
                <div className="mt-2">
                  <CopyButton text={auditPrompt} label="Copy prompt" />
                </div>
              </div>

              <form action={boundSaveAudit} className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-700">
                  Step 2 — Paste the AI&rsquo;s JSON response
                </label>
                <textarea
                  name="audit_json"
                  rows={6}
                  placeholder='{"overall_score": 42, "top_problems": [...], ...}'
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                />
                <button
                  type="submit"
                  className="self-end rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save audit
                </button>
              </form>
            </div>
          </details>
        </section>

        {/* Outreach */}
        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Outreach</h2>

          {searchParams.outreachError && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {searchParams.outreachError}
            </p>
          )}
          {searchParams.outreachSaved && (
            <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Draft saved. Nothing is sent automatically — approve it, then send it yourself.
            </p>
          )}

          {outreach.length > 0 && (
            <ul className="mb-5 space-y-3">
              {outreach.map((o) => (
                <li key={o.id} className="rounded-md border border-slate-200 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${OUTREACH_STATUS_COLORS[o.status]}`}
                    >
                      {o.status}
                    </span>
                    <span className="text-xs text-slate-400">
                      {o.channel} &middot; {new Date(o.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  {o.subject && <p className="mb-1 text-sm font-medium">{o.subject}</p>}
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{o.message}</p>

                  <div className="mt-3 flex gap-2">
                    {!o.approved ? (
                      <form action={setOutreachApproval.bind(null, prospect.id, o.id)}>
                        <input type="hidden" name="approved" value="true" />
                        <button
                          type="submit"
                          className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Approve to send
                        </button>
                      </form>
                    ) : o.status !== 'sent' && o.status !== 'replied' ? (
                      <>
                        <form action={setOutreachApproval.bind(null, prospect.id, o.id)}>
                          <input type="hidden" name="approved" value="false" />
                          <button
                            type="submit"
                            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Un-approve
                          </button>
                        </form>
                        <form action={markOutreachSent.bind(null, prospect.id, o.id)}>
                          <button
                            type="submit"
                            className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            Mark as sent by me
                          </button>
                        </form>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">
                        Sent {o.sent_at ? new Date(o.sent_at).toLocaleDateString() : ''}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <details className="group" open={outreach.length === 0}>
            <summary className="cursor-pointer text-sm font-medium text-ink">
              Draft a new outreach message
            </summary>
            <div className="mt-3 space-y-3">
              {altOutreachPrompt && (
                <div>
                  <p className="mb-1 text-xs text-slate-500">
                    Want a different angle? Copy this into Claude for an alternate draft, then paste
                    the result into the message box below.
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-slate-900 p-4 text-xs text-slate-100">
                    {altOutreachPrompt}
                  </pre>
                  <div className="mt-2">
                    <CopyButton text={altOutreachPrompt} label="Copy prompt" />
                  </div>
                </div>
              )}

              <form action={boundSaveOutreach} className="flex flex-col gap-3">
                {latestAudit && <input type="hidden" name="audit_id" value={latestAudit.id} />}
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Channel</label>
                  <select name="channel" defaultValue="email" className="rounded-md border border-slate-300 px-3 py-2 text-sm">
                    <option value="email">Email</option>
                    <option value="phone">Phone script</option>
                    <option value="sms">SMS</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Subject (email only)</label>
                  <input
                    name="subject"
                    defaultValue={latestAudit?.outreach_subject ?? ''}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
                  <textarea
                    name="message"
                    rows={6}
                    defaultValue={latestAudit?.outreach_draft ?? ''}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="self-end rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Save as draft
                </button>
              </form>
            </div>
          </details>
        </section>

        <form action={boundDelete}>
          <ConfirmSubmitButton
            confirmMessage={`Delete ${prospect.business_name}? This also deletes its audits and outreach history.`}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Delete prospect
          </ConfirmSubmitButton>
        </form>
      </main>
    </div>
  );
}
