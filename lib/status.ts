export const PIPELINE_STATUSES = [
  'New',
  'Researching',
  'Audited',
  'Contacted',
  'Replied',
  'Demo Requested',
  'Demo Sent',
  'Call',
  'Won',
  'Lost',
] as const;

export type ProspectStatus = (typeof PIPELINE_STATUSES)[number];

// Tailwind classes per status, used for the badge pill. Kept as a plain
// object (not computed) so Tailwind's content scanner can see every class
// name literally and won't purge them from the production build.
export const STATUS_COLORS: Record<ProspectStatus, string> = {
  New: 'bg-slate-100 text-slate-700',
  Researching: 'bg-blue-100 text-blue-700',
  Audited: 'bg-indigo-100 text-indigo-700',
  Contacted: 'bg-amber-100 text-amber-700',
  Replied: 'bg-orange-100 text-orange-700',
  'Demo Requested': 'bg-purple-100 text-purple-700',
  'Demo Sent': 'bg-fuchsia-100 text-fuchsia-700',
  Call: 'bg-cyan-100 text-cyan-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
};

export function isProspectStatus(value: string): value is ProspectStatus {
  return (PIPELINE_STATUSES as readonly string[]).includes(value);
}
