import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { items, tags, itemTags } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const item = db.select().from(items).where(eq(items.id, id)).get();
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const tagRows = db.select({ tagId: itemTags.tagId }).from(itemTags).where(eq(itemTags.itemId, id)).all();
  const tagList = tagRows.length
    ? db.select().from(tags).where(inArray(tags.id, tagRows.map((t) => t.tagId))).all()
    : [];
  return NextResponse.json({ ...item, tags: tagList });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  const updates: any = { updatedAt: Date.now() };
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === 'read') updates.readAt = Date.now();
    if (body.status === 'unread') updates.readAt = null;
  }
  if (body.pinned !== undefined) updates.pinned = body.pinned ? 1 : 0;

  db.update(items).set(updates).where(eq(items.id, id)).run();
  const item = db.select().from(items).where(eq(items.id, id)).get();
  return NextResponse.json({ item });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.delete(itemTags).where(eq(itemTags.itemId, id)).run();
  db.delete(items).where(eq(items.id, id)).run();
  return NextResponse.json({ success: true });
}
