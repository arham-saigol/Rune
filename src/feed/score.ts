import { getDb } from '@/db/client';
import { items, tags, itemTags } from '@/db/schema';
import { cosineSimilarity, float32ArrayFromBuffer, normalizeScores } from '@/lib/cosine';
import { FEED_WEIGHTS } from '@/lib/constants';
import { eq, gte, and } from 'drizzle-orm';

const ONE_DAY = 24 * 60 * 60 * 1000;
const SEVEN_DAYS = 7 * ONE_DAY;

export interface ScoredItem {
  id: string;
  title: string;
  platform: string;
  contentType: string;
  illustration: string | null;
  status: string;
  pinned: number;
  createdAt: number;
  tags: { id: number; name: string; slug: string }[];
  score: number;
}

export function scoreFeed(): ScoredItem[] {
  const db = getDb();
  const now = Date.now();

  // Fetch all unread items
  const unreadItems = db.select().from(items).where(eq(items.status, 'unread')).all();
  if (unreadItems.length === 0) return [];

  // Fetch all tags for all items
  const allItemIds = unreadItems.map((i) => i.id);
  const allLinks = db.select().from(itemTags).all();
  const allTags = db.select().from(tags).all();

  const itemTagMap = new Map<string, { id: number; name: string; slug: string }[]>();
  for (const link of allLinks) {
    if (!allItemIds.includes(link.itemId)) continue;
    const tag = allTags.find((t) => t.id === link.tagId);
    if (!tag) continue;
    if (!itemTagMap.has(link.itemId)) itemTagMap.set(link.itemId, []);
    itemTagMap.get(link.itemId)!.push(tag);
  }

  // 1. Recency of Related Reads (last 7 days)
  const recentReads = db
    .select()
    .from(items)
    .where(and(eq(items.status, 'read'), gte(items.readAt, now - SEVEN_DAYS)))
    .all();

  const recentEmbeddings = recentReads
    .filter((r) => r.embedding)
    .map((r) => float32ArrayFromBuffer(r.embedding as Buffer));

  const recencySimilarity = unreadItems.map((item) => {
    if (!item.embedding || recentEmbeddings.length === 0) return 0;
    const itemVec = float32ArrayFromBuffer(item.embedding as Buffer);
    return Math.max(...recentEmbeddings.map((r) => cosineSimilarity(itemVec, r)));
  });

  // 2. Tag Affinity
  const recentTagCounts = new Map<number, number>();
  for (const read of recentReads) {
    const itemTagList = itemTagMap.get(read.id) ?? [];
    for (const tag of itemTagList) {
      recentTagCounts.set(tag.id, (recentTagCounts.get(tag.id) || 0) + 1);
    }
  }
  const totalRecentTags = Array.from(recentTagCounts.values()).reduce((a, b) => a + b, 0);
  const tagWeights = new Map<number, number>();
  if (totalRecentTags > 0) {
    for (const [tagId, count] of recentTagCounts) {
      tagWeights.set(tagId, count / totalRecentTags);
    }
  }

  const tagAffinity = unreadItems.map((item) => {
    const itemTagList = itemTagMap.get(item.id) ?? [];
    let sum = 0;
    for (const tag of itemTagList) {
      sum += tagWeights.get(tag.id) || 0;
    }
    return sum;
  });

  // 3. Pinned Similarity
  const pinnedItems = db.select().from(items).where(eq(items.pinned, 1)).all();
  const pinnedEmbeddings = pinnedItems
    .filter((p) => p.embedding)
    .map((p) => float32ArrayFromBuffer(p.embedding as Buffer));

  const pinnedSimilarity = unreadItems.map((item) => {
    if (!item.embedding || pinnedEmbeddings.length === 0) return 0;
    const itemVec = float32ArrayFromBuffer(item.embedding as Buffer);
    return Math.max(...pinnedEmbeddings.map((p) => cosineSimilarity(itemVec, p)));
  });

  // 4. Recency Boost
  const recencyBoost = unreadItems.map((item) => {
    const daysSince = (now - item.createdAt) / ONE_DAY;
    return Math.exp(-0.1 * daysSince);
  });

  // 5. Staleness Penalty
  const stalenessPenalty = unreadItems.map((item) => {
    const daysSince = (now - item.createdAt) / ONE_DAY;
    return 1 - Math.exp(-0.02 * daysSince);
  });

  // Normalize signals
  const nRecency = normalizeScores(recencySimilarity);
  const nTag = normalizeScores(tagAffinity);
  const nPinned = normalizeScores(pinnedSimilarity);

  // Compute final scores
  const scored = unreadItems.map((item, i) => {
    const score =
      FEED_WEIGHTS.recencySimilarity * nRecency[i] +
      FEED_WEIGHTS.tagAffinity * nTag[i] +
      FEED_WEIGHTS.pinnedSimilarity * nPinned[i] +
      FEED_WEIGHTS.recencyBoost * recencyBoost[i] -
      FEED_WEIGHTS.stalenessPenalty * stalenessPenalty[i];

    return {
      id: item.id,
      title: item.title,
      platform: item.platform,
      contentType: item.contentType,
      illustration: item.illustration,
      status: item.status,
      pinned: item.pinned,
      createdAt: item.createdAt,
      tags: itemTagMap.get(item.id) ?? [],
      score,
    };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Diversity enforcement
  return enforceDiversity(scored);
}

function enforceDiversity(scored: ScoredItem[]): ScoredItem[] {
  const result: ScoredItem[] = [];
  const remaining = [...scored];

  while (remaining.length > 0) {
    let selected: ScoredItem | null = null;
    let selectedIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const item = remaining[i];
      const tagCounts = new Map<string, number>();
      for (const r of result) {
        for (const t of r.tags) {
          tagCounts.set(t.slug, (tagCounts.get(t.slug) || 0) + 1);
        }
      }

      // Constraint a: no single tag occupies more than 1/3
      const violatesA = item.tags.some((t) => {
        const count = (tagCounts.get(t.slug) || 0) + 1;
        return count > Math.ceil(result.length / 3) + 1;
      });

      // Constraint b: no two consecutive items share primary tag
      const last = result[result.length - 1];
      const violatesB =
        last &&
        item.tags.length > 0 &&
        last.tags.length > 0 &&
        item.tags[0].slug === last.tags[0].slug;

      if (!violatesA && !violatesB) {
        selected = item;
        selectedIndex = i;
        break;
      }
    }

    if (!selected) {
      selected = remaining[0];
      selectedIndex = 0;
    }

    result.push(selected);
    remaining.splice(selectedIndex, 1);
  }

  return result;
}
