// Inserts a handful of sample HVAC prospects so you can click through the
// dashboard, filters, and detail page immediately — before you've found any
// real prospects yet. Every row is tagged in `notes` so you can find and
// delete them later.
//
// Run with: npm run seed  (make sure .env.local is filled in first)

try {
  // Node 20.6+ — loads .env.local without needing the `dotenv` package.
  process.loadEnvFile('.env.local');
} catch {
  console.warn('Could not auto-load .env.local — make sure SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set some other way.');
}

import { getDb } from '../lib/supabase';

const SEED_NOTE = 'Seed/test data — safe to delete.';

const SAMPLE_PROSPECTS = [
  {
    business_name: 'Sunrise Heating & Air',
    website: 'https://example.com/sunrise-hvac',
    phone: '555-010-1000',
    email: 'info@example.com',
    city: 'Plano, TX',
    niche: 'HVAC',
    status: 'New',
    notes: SEED_NOTE,
  },
  {
    business_name: 'Coolzone HVAC Services',
    website: null,
    phone: '555-010-1001',
    email: null,
    city: 'Frisco, TX',
    niche: 'HVAC',
    status: 'Researching',
    notes: `${SEED_NOTE} No website found — only a Facebook page.`,
  },
  {
    business_name: 'Reliable Comfort Systems',
    website: 'https://example.com/reliable-comfort',
    phone: '555-010-1002',
    email: 'contact@example.com',
    city: 'McKinney, TX',
    niche: 'HVAC',
    status: 'Audited',
    website_score: 38,
    problems_found: [
      'No mobile-friendly layout',
      'No visible phone number above the fold',
      'No quote/contact form, only an email address',
    ],
    opportunity: 'Losing mobile visitors who can’t find a way to call or request a quote.',
    personalized_pitch:
      'Hi — I noticed Reliable Comfort’s site is hard to use on a phone and has no quote form, which likely costs you jobs. I’d like to show you a free mockup of a faster, mobile-friendly version with a one-tap "Get a Quote" button.',
    notes: SEED_NOTE,
  },
  {
    business_name: 'Northside Air Conditioning',
    website: 'https://example.com/northside-ac',
    phone: '555-010-1003',
    email: 'service@example.com',
    city: 'Allen, TX',
    niche: 'HVAC',
    status: 'Contacted',
    website_score: 52,
    problems_found: ['Outdated design (looks 10+ years old)', 'No reviews shown anywhere'],
    notes: SEED_NOTE,
  },
  {
    business_name: 'Bluebonnet Heating & Cooling',
    website: null,
    phone: '555-010-1004',
    email: 'owner@example.com',
    city: 'Denton, TX',
    niche: 'HVAC',
    status: 'Won',
    website_score: 20,
    notes: `${SEED_NOTE} Great first test case for the client/project flow.`,
  },
];

async function main() {
  const db = getDb();

  const { data, error } = await db.from('prospects').insert(SAMPLE_PROSPECTS).select('id, business_name');

  if (error) {
    console.error('Seed failed:', error.message);
    process.exit(1);
  }

  console.log(`Inserted ${data?.length ?? 0} sample prospects:`);
  for (const row of data ?? []) {
    console.log(`  - ${row.business_name}`);
  }
}

main();
