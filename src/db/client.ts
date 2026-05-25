import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

const dbPath = process.env.DATA_DIR ? `${process.env.DATA_DIR}/rune.db` : './data/rune.db';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!db) {
    const sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });
  }
  return db;
}

export function initDatabase() {
  const sqlite = new Database(dbPath);
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_platform ON items(platform);
    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
    CREATE INDEX IF NOT EXISTS idx_items_read_at ON items(read_at);
    CREATE INDEX IF NOT EXISTS idx_items_pinned ON items(pinned);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);
  return drizzle(sqlite, { schema });
}
