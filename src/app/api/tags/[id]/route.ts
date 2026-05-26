import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { tags, itemTags } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId) || numericId <= 0 || !Number.isInteger(numericId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  const body = await req.json();
  if (typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }
  const db = getDb();
  db.update(tags).set({ name: body.name.trim() }).where(eq(tags.id, numericId)).run();
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.delete(itemTags).where(eq(itemTags.tagId, Number(id))).run();
  db.delete(tags).where(eq(tags.id, Number(id))).run();
  return NextResponse.json({ success: true });
}
