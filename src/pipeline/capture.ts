import { ulid } from 'ulidx';
import { detectPlatform } from './detect-platform';
import { fetchYouTube } from './fetch-youtube';
import { fetchVideo } from './fetch-video';
import { fetchWebContent } from './fetch-web';
import { embedItem } from './embed-item';
import { runLibrarian } from '@/agents/librarian';
import { getDb } from '@/db/client';
import { items, tags, itemTags } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function captureItem(url: string, userContext?: string) {
  const platform = detectPlatform(url);
  const db = getDb();

  // 1. Fetch content
  let content: string | null = null;
  switch (platform.platform) {
    case 'youtube':
      content = await fetchYouTube(url, platform.videoId);
      break;
    case 'x':
    case 'reddit':
    case 'producthunt':
    case 'instagram':
    case 'web':
      content = await fetchWebContent(url);
      break;
  }

  // 2. If platform hosts video but isn't YouTube, try yt-dlp
  if (!content && platform.contentType === 'video') {
    content = await fetchVideo(url, ulid());
  }

  // 3. Call Librarian Agent to generate metadata
  const availableTags = db.select().from(tags).all();
  const catalog = await runLibrarian(url, content, userContext, availableTags);

  // 4. Embed the meta summary
  const embedding = await embedItem(catalog.metaSummary);

  // 5. Store in database
  const id = ulid();
  const now = Date.now();
  db.insert(items).values({
    id,
    url,
    platform: platform.platform,
    contentType: platform.contentType,
    title: catalog.title,
    metaSummary: catalog.metaSummary,
    metaKeywords: JSON.stringify(catalog.keywords),
    content: content ?? undefined,
    userContext,
    illustration: JSON.stringify(catalog.illustration),
    embedding: Buffer.from(new Float32Array(embedding).buffer),
    status: 'unread',
    pinned: 0,
    createdAt: now,
    updatedAt: now,
  }).run();

  // 6. Link tags
  for (const slug of catalog.tagSlugs) {
    const tag = db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (tag) {
      db.insert(itemTags).values({ itemId: id, tagId: tag.id }).run();
    }
  }

  return db.select().from(items).where(eq(items.id, id)).get();
}
