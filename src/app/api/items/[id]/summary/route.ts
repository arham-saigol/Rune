import { NextRequest } from 'next/server';
import { getDb } from '@/db/client';
import { items, summaries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { runSummaryAgent } from '@/agents/summary';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') || 'short';

  const db = getDb();

  // Check cache
  const cached = db
    .select()
    .from(summaries)
    .where(and(eq(summaries.itemId, id), eq(summaries.mode, mode)))
    .get();

  if (cached) {
    return new Response(cached.content, { headers: { 'content-type': 'text/plain' } });
  }

  const item = db.select().from(items).where(eq(items.id, id)).get();
  if (!item) {
    return new Response('Item not found', { status: 404 });
  }

  const content = (item.content || item.metaSummary).slice(0, 30000);
  const result = await runSummaryAgent(content, mode);

  let fullText = '';
  let completed = false;
  const encoder = new TextEncoder();

  const output = new ReadableStream({
    async start(controller) {
      const reader = result.textStream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            completed = true;
            break;
          }
          fullText += value;
          controller.enqueue(encoder.encode(value));
        }
      } catch (err) {
        console.error('Summary stream error:', err);
      } finally {
        controller.close();
        if (completed && fullText) {
          db.insert(summaries).values({
            itemId: id,
            mode,
            content: fullText,
            createdAt: Date.now(),
          }).run();
        }
      }
    },
  });

  return new Response(output, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
