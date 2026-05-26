import { sqliteTable, text, integer, blob, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const items = sqliteTable('items', {
  id: text('id').primaryKey(),
  url: text('url').notNull(),
  platform: text('platform').notNull(),
  contentType: text('content_type').notNull(),
  title: text('title').notNull(),
  metaSummary: text('meta_summary').notNull(),
  metaKeywords: text('meta_keywords').notNull(),
  content: text('content'),
  userContext: text('user_context'),
  illustration: text('illustration'),
  embedding: blob('embedding'),
  status: text('status').notNull().default('unread'),
  pinned: integer('pinned').notNull().default(0),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  isDefault: integer('is_default').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export const itemTags = sqliteTable('item_tags', {
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  tagId: integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));

export const summaries = sqliteTable('summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: text('item_id').notNull().references(() => items.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  uniqueItemMode: uniqueIndex('idx_summaries_item_mode').on(table.itemId, table.mode),
}));

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  contextItemId: text('context_item_id').references(() => items.id, { onDelete: 'set null' }),
  createdAt: integer('created_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
