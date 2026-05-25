import { getDb } from './client';
import { tags } from './schema';
import { eq } from 'drizzle-orm';

const DEFAULT_TAGS = [
  { name: 'SEO', slug: 'seo' },
  { name: 'AI', slug: 'ai' },
  { name: 'SaaS', slug: 'saas' },
  { name: 'Dev', slug: 'dev' },
  { name: 'Design', slug: 'design' },
  { name: 'Startup', slug: 'startup' },
  { name: 'Marketing', slug: 'marketing' },
  { name: 'Productivity', slug: 'productivity' },
];

async function main() {
  const db = getDb();
  for (const tag of DEFAULT_TAGS) {
    const existing = db.select().from(tags).where(eq(tags.slug, tag.slug)).get();
    if (!existing) {
      db.insert(tags).values({
        ...tag,
        isDefault: 1,
        createdAt: Date.now(),
      }).run();
    }
  }
  console.log('Default tags seeded');
}

main().catch(console.error);
