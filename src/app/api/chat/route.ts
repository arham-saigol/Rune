import { NextRequest } from 'next/server';
import { runRuneAgent } from '@/agents/rune';
import { getDb } from '@/db/client';
import { conversations, messages } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulidx';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { message, conversationId: cid, contextItemId } = body;

  const db = getDb();
  let conversationId = cid;

  if (!conversationId) {
    conversationId = ulid();
    db.insert(conversations).values({
      id: conversationId,
      source: 'web',
      contextItemId: contextItemId || null,
      createdAt: Date.now(),
    }).run();
  }

  // Persist user message
  db.insert(messages).values({
    id: ulid(),
    conversationId,
    role: 'user',
    content: message,
    createdAt: Date.now(),
  }).run();

  // Get history
  const history = db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(20)
    .all()
    .reverse();

  const result = await runRuneAgent(
    history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
  );

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
        console.error('Chat stream error:', err);
      } finally {
        controller.close();
        if (completed && fullText) {
          db.insert(messages).values({
            id: ulid(),
            conversationId,
            role: 'assistant',
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
