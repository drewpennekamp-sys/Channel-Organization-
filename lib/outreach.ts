import type { Audit, Prospect } from './types';

/**
 * Prompt for generating a second/alternate outreach draft once you already
 * have an audit — e.g. if the first draft from the audit felt too generic,
 * or you want a version for a different channel (a phone-call script
 * instead of an email). Same manual copy/paste-into-Claude flow as the
 * audit prompt, same reason: $0 cost, and you review every word before it
 * could ever be sent.
 */
export function buildAlternateOutreachPrompt(prospect: Prospect, audit: Audit): string {
  return `Write a short, personalized outreach message for a local ${prospect.niche} business, based on a web-presence audit I already ran.

Business: ${prospect.business_name}
Top problems found: ${audit.top_problems.join('; ')}
Sales angle: ${audit.sales_angle ?? 'n/a'}

Write ONE alternate version of the outreach message (100-150 words if email, ~60 words if it reads naturally as a phone-call opener). Reference a specific problem from the list above. Friendly, direct, no hype, no fake urgency or scarcity. Offer a free mockup/demo as the next step. Sign off as me.

Respond with plain text only — just the message, no JSON, no preamble.`;
}
