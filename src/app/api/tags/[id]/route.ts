import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { tags, itemTags } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  if (body.name && body.name.trim()) {
    db.update(tags).set({ name: body.name.trim() }).where(eq(tags.id, Number(id))).run();
  }
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  db.delete(itemTags).where(eq(itemTags.tagId, Number(id))).run();
  db.delete(tags).where(eq(tags.id, Number(id))).run();
  return NextResponse.json({ success: true });
}
