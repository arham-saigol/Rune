import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { items, tags, itemTags } from '@/db/schema';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { captureItem } from '@/pipeline/capture';
import { semanticSearch } from '@/agents/tools/semantic-search';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tag = searchParams.get('tag');
  const status = searchParams.get('status');
  const platform = searchParams.get('platform');
  const q = searchParams.get('q');
  const sort = searchParams.get('sort') || 'created_desc';

  const db = getDb();

  if (q) {
    const results = await semanticSearch(q, 50);
    return NextResponse.json({ items: results });
  }

  let query = db.select().from(items) as any;
  const conditions = [];

  if (status) conditions.push(eq(items.status, status));
  if (platform) conditions.push(eq(items.platform, platform));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  let results = query.all() as typeof items.$inferSelect[];

  if (tag) {
    const tagRow = db.select().from(tags).where(eq(tags.slug, tag)).get();
    if (tagRow) {
      const links = db.select({ itemId: itemTags.itemId }).from(itemTags).where(eq(itemTags.tagId, tagRow.id)).all();
      const linkSet = new Set(links.map((l) => l.itemId));
      results = results.filter((r) => linkSet.has(r.id));
    } else {
      results = [];
    }
  }

  if (sort === 'created_desc') {
    results.sort((a, b) => b.createdAt - a.createdAt);
  } else if (sort === 'created_asc') {
    results.sort((a, b) => a.createdAt - b.createdAt);
  }

  return NextResponse.json({ items: results });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { url, context } = body;
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }
  const item = await captureItem(url, context);
  return NextResponse.json({ item });
}
