import { getDb } from './client';

async function main() {
  const db = getDb();
  // Drizzle migrations are handled by drizzle-kit generate + migrate
  // For now, ensure tables exist via manual creation if needed
  const sqlite = (db as any).$client as any;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      platform TEXT NOT NULL,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      meta_summary TEXT NOT NULL,
      meta_keywords TEXT NOT NULL,
      content TEXT,
      user_context TEXT,
      illustration TEXT,
      embedding BLOB,
      status TEXT NOT NULL DEFAULT 'unread',
      pinned INTEGER NOT NULL DEFAULT 0,
      read_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS item_tags (
      item_id TEXT NOT NULL REFERENCES items(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (item_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL REFERENCES items(id),
      mode TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(item_id, mode)
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      context_item_id TEXT REFERENCES items(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_platform ON items(platform);
    CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at);
    CREATE INDEX IF NOT EXISTS idx_items_read_at ON items(read_at);
    CREATE INDEX IF NOT EXISTS idx_items_pinned ON items(pinned);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);
  console.log('Migrations applied');
}

main().catch(console.error);
