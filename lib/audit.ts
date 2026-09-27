import { z } from 'zod';
import type { Prospect } from './types';

// What we ask the AI to return, and what we validate its answer against
// before trusting it. Keeping this schema narrow (short arrays, capped
// score) means a malformed or hallucinated response fails loudly here
// instead of silently corrupting a prospect record.
export const AuditResultSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  top_problems: z.array(z.string()).min(1).max(5),
  recommended_improvements: z.array(z.string()).min(1).max(8),
  sales_angle: z.string().min(1),
  outreach_subject: z.string().min(1),
  outreach_message: z.string().min(1),
});

export type AuditResult = z.infer<typeof AuditResultSchema>;

/**
 * Builds the prompt you paste into Claude (claude.ai, or a Claude Code chat)
 * to audit one prospect's web presence. Designed to work two ways:
 *  - If the AI you're pasting this into can browse the web, it fetches the
 *    site itself.
 *  - If not, you paste in what you see (homepage text, or just a
 *    description of their Google/Facebook/Instagram presence) where marked.
 *
 * This step is deliberately manual (copy prompt → run in Claude → paste
 * JSON back) rather than an automatic API call, so the audit step costs
 * $0 — it rides on the Claude Code / claude.ai access you already have
 * instead of a metered Anthropic API key.
 */
export function buildAuditPrompt(prospect: Prospect): string {
  const hasWebsite = Boolean(prospect.website && prospect.website.trim());

  return `You are auditing the web presence of a local ${prospect.niche} business, as part of building a sales case for a website/lead-generation package.

Business: ${prospect.business_name}
City: ${prospect.city ?? 'unknown'}
Website: ${hasWebsite ? prospect.website : 'NONE — this business has no website. Judge them on their Google Business Profile, Facebook page, and/or Instagram instead.'}
${prospect.notes ? `Notes I've gathered so far: ${prospect.notes}` : ''}

${
  hasWebsite
    ? "If you can browse the web, visit the site above directly. If you can't, I'll paste the homepage text or a screenshot description below this prompt before you answer."
    : "If you can browse the web, look up this business's Google Business Profile / Facebook / Instagram. If you can't, I'll paste what I found below this prompt before you answer."
}

Evaluate across these dimensions:
- Mobile UX (does it work well on a phone?)
- CTA visibility (is "call now" / "get a quote" obvious?)
- Quote/contact forms (do they exist? are they easy to find and use?)
- Trust signals (licensing, insurance, years in business, certifications)
- Service descriptions (clear list of services offered, e.g. AC repair, furnace install)
- Reviews (are reviews visible/linked? how many, what rating?)
- Page structure (organized, easy to navigate, fast-loading impression)
- Conversion issues (anything that would make a visitor leave without contacting them)
- Outdated design (visual age, broken elements, non-responsive layout)
- Local SEO (city/service-area mentioned, Google Business Profile linked)

Respond with ONLY valid JSON, no markdown fences, no commentary, in exactly this shape:

{
  "overall_score": <integer 0-100, lower = worse web presence = bigger opportunity for us>,
  "top_problems": [<1 to 5 short, concrete problem strings, most important first>],
  "recommended_improvements": [<1 to 8 short, concrete fixes>],
  "sales_angle": "<1-2 sentences: the single strongest reason THIS business should care, tied to losing jobs/customers>",
  "outreach_subject": "<a short, non-spammy email subject line>",
  "outreach_message": "<a 100-150 word personalized outreach email. Reference a SPECIFIC problem you found. Friendly, direct, no hype, no fake urgency, offer a free mockup/demo as the next step, sign off as me>"
}`;
}
