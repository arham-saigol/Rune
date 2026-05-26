import { Chat } from 'chat';
import { createDiscordAdapter } from '@chat-adapter/discord';
import { runRuneAgent } from '../agents/rune';
import { getDb } from '../db/client';
import { conversations, messages } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { ulid } from 'ulidx';

const memoryStateAdapter = {
  async acquireLock() { return null; },
  async appendToList() {},
  async connect() {},
  async delete() {},
  async dequeue() { return null; },
  async disconnect() {},
  async enqueue() { return 0; },
  async extendLock() { return false; },
  async fetchHistory() { return []; },
  async fetchMessage() { return null; },
  async fetchState() { return {}; },
  async listMessages() { return []; },
  async listThreadIds() { return []; },
  async listThreads() { return []; },
  async releaseLock() {},
  async saveMessage() {},
  async setState() {},
  async updateMessage() {},
};

export function createBot() {
  const bot = new Chat({
    userName: 'rune',
    adapters: {
      discord: createDiscordAdapter(),
    },
    state: memoryStateAdapter as any,
  });

  const allowedIds = new Set(
    (process.env.ALLOWED_DISCORD_USER_IDS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );

  if (allowedIds.size === 0 && process.env.NODE_ENV !== 'development') {
    throw new Error(
      'ALLOWED_DISCORD_USER_IDS is required. Set it or run in development mode.'
    );
  }

  bot.onNewMention(async (thread, message) => {
    if (allowedIds.size > 0 && !allowedIds.has((message.author as any).id)) {
      console.error(
        `[${new Date().toISOString()}] Unauthorized access attempt by user ${(message.author as any).username} (${(message.author as any).id}) in thread ${thread.id}`
      );
      await thread.post('You are not authorized to use this bot.');
      return;
    }

    await thread.subscribe();

    const userMessage = message.text;
    const conversationId = thread.id;

    const db = getDb();

    // Ensure conversation
    const existing = db.select().from(conversations).where(eq(conversations.id, conversationId)).get();
    if (!existing) {
      db.insert(conversations).values({
        id: conversationId,
        source: 'discord',
        contextItemId: null,
        createdAt: Date.now(),
      }).run();
    }

    // Get history
    const history = db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(20)
      .all()
      .reverse();

    // Generate response
    const result = await runRuneAgent([
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
    ]);

    // Persist messages
    db.insert(messages).values({
      id: ulid(),
      conversationId,
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
    }).run();

    const text = await result.text;
    db.insert(messages).values({
      id: ulid(),
      conversationId,
      role: 'assistant',
      content: text,
      createdAt: Date.now(),
    }).run();

    await thread.post(text);
  });

  return bot;
}
