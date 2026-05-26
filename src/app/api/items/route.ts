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
    let filtered = results;
    if (status) {
      filtered = filtered.filter((item) => item.status === status);
    }
    if (platform) {
      filtered = filtered.filter((item) => item.platform === platform);
    }
    if (tag) {
      const tagRow = db.select().from(tags).where(eq(tags.slug, tag)).get();
      if (tagRow) {
        const links = db.select({ itemId: itemTags.itemId }).from(itemTags).where(eq(itemTags.tagId, tagRow.id)).all();
        const linkSet = new Set(links.map((l) => l.itemId));
        filtered = filtered.filter((r) => linkSet.has(r.id));
      } else {
        filtered = [];
      }
    }
    if (sort === 'created_asc') {
      filtered.sort((a, b) => a.createdAt - b.createdAt);
    } else {
      filtered.sort((a, b) => b.createdAt - a.createdAt);
    }
    return NextResponse.json({ items: filtered });
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
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'URL must use http or https' }, { status: 400 });
    }
    if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      return NextResponse.json({ error: 'URL host is not allowed' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (context && context.length > 10000) {
    return NextResponse.json({ error: 'Context exceeds 10,000 characters' }, { status: 400 });
  }
  const item = await captureItem(url, context);
  return NextResponse.json({ item });
}
