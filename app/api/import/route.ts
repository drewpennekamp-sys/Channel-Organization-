import { NextResponse } from 'next/server';
import { applyImport } from '@/lib/exportImport';
import { importDataSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = importDataSchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      {
        error: `This doesn't look like a Shorts Factory backup file${
          firstIssue ? ` (${firstIssue.path.join('.')}: ${firstIssue.message})` : ''
        }`,
      },
      { status: 422 }
    );
  }

  try {
    const counts = await applyImport(parsed.data);
    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import failed';
    return NextResponse.json({ error: `Import failed partway through: ${message}` }, { status: 500 });
  }
}
