import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';

export async function GET() {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, 'default_video_gen_tool'))
    .get();

  return NextResponse.json({
    defaultVideoGenTool: row?.value ?? '',
  });
}
