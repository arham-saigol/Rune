import { getDb } from '@/db/client';
import { items, tags, itemTags } from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';

export async function getItem(id: string) {
  const db = getDb();
  const item = db.select().from(items).where(eq(items.id, id)).get();
  if (!item) return null;
  const tagRows = db.select({ tagId: itemTags.tagId }).from(itemTags).where(eq(itemTags.itemId, id)).all();
  const tagList = tagRows.length
    ? db.select().from(tags).where(inArray(tags.id, tagRows.map((t) => t.tagId))).all()
    : [];
  return { ...item, tags: tagList };
}

export async function listItems(filters: {
  tag?: string;
  platform?: string;
  status?: string;
  pinned?: boolean;
  fromDate?: number;
  toDate?: number;
  limit?: number;
  offset?: number;
} = {}) {
  const db = getDb();
  let query = db.select().from(items) as any;
  const conditions = [];

  if (filters.platform) conditions.push(eq(items.platform, filters.platform));
  if (filters.status) conditions.push(eq(items.status, filters.status));
  if (filters.pinned !== undefined) conditions.push(eq(items.pinned, filters.pinned ? 1 : 0));
  if (filters.fromDate) conditions.push(gte(items.createdAt, filters.fromDate));
  if (filters.toDate) conditions.push(lte(items.createdAt, filters.toDate));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const results = query.all() as typeof items.$inferSelect[];

  if (filters.tag) {
    const tagRow = db.select().from(tags).where(eq(tags.slug, filters.tag)).get();
    if (tagRow) {
      const links = db.select({ itemId: itemTags.itemId }).from(itemTags).where(eq(itemTags.tagId, tagRow.id)).all();
      const linkSet = new Set(links.map((l) => l.itemId));
      return results.filter((r) => linkSet.has(r.id));
    }
    return [];
  }

  return results.slice(filters.offset ?? 0, (filters.offset ?? 0) + (filters.limit ?? 1000));
}
