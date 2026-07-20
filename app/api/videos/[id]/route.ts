import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { postedVideos } from '@/lib/db/schema';
import { videoUpdateSchema } from '@/lib/validation';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const existing = await db.select().from(postedVideos).where(eq(postedVideos.id, params.id)).get();
  if (!existing) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = videoUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const updates: Partial<typeof postedVideos.$inferInsert> = {};

  if (data.ideaTitle !== undefined) updates.ideaTitle = data.ideaTitle;
  if (data.postedAt !== undefined) updates.postedAt = new Date(data.postedAt);
  if (data.views !== undefined) updates.views = data.views;
  if (data.likes !== undefined) updates.likes = data.likes;
  if (data.comments !== undefined) updates.comments = data.comments;
  if (data.shares !== undefined) updates.shares = data.shares;
  if (data.avgViewDuration !== undefined) updates.avgViewDuration = data.avgViewDuration;
  if (data.retentionNote !== undefined) updates.retentionNote = data.retentionNote || null;

  if (Object.keys(updates).length > 0) {
    await db.update(postedVideos).set(updates).where(eq(postedVideos.id, params.id));
  }

  const video = await db.select().from(postedVideos).where(eq(postedVideos.id, params.id)).get();

  return NextResponse.json({ video });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const existing = await db.select().from(postedVideos).where(eq(postedVideos.id, params.id)).get();
  if (!existing) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }

  await db.delete(postedVideos).where(eq(postedVideos.id, params.id));

  return NextResponse.json({ ok: true });
}
