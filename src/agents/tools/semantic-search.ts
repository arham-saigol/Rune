import { getDb } from '@/db/client';
import { items } from '@/db/schema';
import { cosineSimilarity, float32ArrayFromBuffer } from '@/lib/cosine';
import { embed } from 'ai';

export async function semanticSearch(query: string, limit = 5) {
  const db = getDb();
  const { embedding } = await embed({
    model: 'voyage/voyage-4-lite',
    value: query,
    providerOptions: {
      voyage: { inputType: 'query', outputDimension: 1024 },
    },
  });
  const queryVec = new Float32Array(embedding);

  const allItems = db.select().from(items).all();
  const scored = allItems
    .map((item) => {
      if (!item.embedding) return null;
      const vec = float32ArrayFromBuffer(item.embedding as Buffer);
      if (!vec) return null;
      return {
        item,
        score: cosineSimilarity(queryVec, vec),
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.item);
}
