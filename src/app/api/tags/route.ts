import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { tags, itemTags } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const all = db.select().from(tags).all();
  return NextResponse.json({ tags: all });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, slug } = body;
  if (!name || !slug) {
    return NextResponse.json({ error: 'Name and slug required' }, { status: 400 });
  }
  const db = getDb();
  db.insert(tags).values({
    name,
    slug,
    isDefault: 0,
    createdAt: Date.now(),
  }).run();
  const all = db.select().from(tags).all();
  return NextResponse.json({ tags: all });
}
