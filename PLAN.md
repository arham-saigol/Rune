# Rune — Implementation Plan

## 1. Overview

Rune is a self-hosted personal second brain. A single user saves content from YouTube, X, Instagram, Reddit, Product Hunt, and the open web via a Discord bot. A web app (PWA) lets them browse, search, and converse with an AI agent about everything they've collected. Three AI agents power the system: the main **Rune Agent** (conversational), the **Librarian Agent** (saving and cataloging), and the **Summary Agent** (on-demand item summaries). A CLI tool handles VPS setup and service management.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        VPS (Single Process)                      │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                    Gateway Process                        │    │
│  │                                                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐  │    │
│  │  │  Next.js     │  │  Discord     │  │  Background      │  │    │
│  │  │  HTTP Server │  │  Bot (Chat   │  │  Workers         │  │    │
│  │  │  (Web UI +   │  │  SDK Gateway │  │  (Capture        │  │    │
│  │  │   API routes)│  │  WebSocket)  │  │   Pipeline)      │  │    │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │    │
│  │         │                 │                    │            │    │
│  │         └────────────┬────┴────────────────────┘            │    │
│  │                      │                                      │    │
│  │              ┌───────▼────────┐                              │    │
│  │              │  Core Engine   │                              │    │
│  │              │  (Agents, DB,  │                              │    │
│  │              │   Embeddings,  │                              │    │
│  │              │   Pipeline)    │                              │    │
│  │              └───────┬────────┘                              │    │
│  │                      │                                      │    │
│  │              ┌───────▼────────┐                              │    │
│  │              │  SQLite + FS   │                              │    │
│  │              └────────────────┘                              │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  cloudflared tunnel  ──────►  Cloudflare Edge            │    │
│  │                                (Access Policy)           │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘

External APIs:
  ├── Vercel AI Gateway  →  DeepSeek V4 Pro / Flash
  ├── DeepSeek API       →  Fallback for AI Gateway
  ├── Voyage AI API      →  Embeddings (voyage-4, voyage-4-lite)
  ├── Exa API            →  Web search + content fetch
  ├── SupaData API       →  YouTube transcript extraction
  ├── Deepgram API       →  Audio transcription (yt-dlp fallback)
  └── Discord Gateway    →  Bot WebSocket connection
```

### Process Model

The **gateway** is a single Node.js process managed by systemd. It runs:

1. **Next.js HTTP server** — serves the PWA and API routes on a local port (e.g., `127.0.0.1:3000`).
2. **Chat SDK Discord gateway listener** — maintains a persistent WebSocket to Discord. No public webhook URL needed.
3. **Background capture workers** — process newly shared links: fetch content, generate metadata, embed, and store.

Cloudflare Tunnel connects the local port to a public hostname. Cloudflare Access enforces authentication before any request reaches the app.

The **CLI tool** is a separate binary entry point that manages the systemd service and writes configuration.

---

## 3. Technology Stack

| Layer | Technology | Details |
|-------|-----------|---------|
| Framework | Next.js 15 (standalone output) | App Router, React Server Components, API routes |
| AI Core | AI SDK v6 (`ai` npm package) | `ToolLoopAgent`, `generateText`, `streamText`, `embed`, `embedMany` |
| AI Models | DeepSeek V4 Pro, DeepSeek V4 Flash | Via Vercel AI Gateway (`deepseek/deepseek-v4-pro`, `deepseek/deepseek-v4-flash`) with direct DeepSeek API as fallback |
| Embeddings | Voyage 4 series | `voyage-4` for document embedding, `voyage-4-lite` for query embedding. Via AI Gateway (`voyage/voyage-4`, `voyage/voyage-4-lite`). Shared embedding space — cross-model compatibility. |
| DeepSeek Direct | `@ai-sdk/deepseek` (v2.0.35) | Direct provider for fallback when AI Gateway is down. `deepseek('deepseek-v4-pro')`. |
| Web Search | Exa API (`exa-js`) | Neural search + content extraction. Types: `auto`, `fast`, `deep`. |
| Transcripts | SupaData API | Primary for YouTube. `GET https://api.supadata.ai/v1/transcript?url=...`. AI fallback when no captions. |
| Audio Transcription | Deepgram Nova-3 (`@deepgram/sdk`) | Fallback for YouTube (via yt-dlp audio), primary for non-YouTube video platforms. |
| Video Download | yt-dlp (system binary) | Audio extraction for transcription. 1000+ platform support. |
| Discord Bot | Chat SDK (`chat` + `@chat-adapter/discord`) | `createDiscordAdapter()` + `startGatewayListener()` for WebSocket mode. |
| Database | SQLite via `better-sqlite3` | Drizzle ORM for schema and queries. Stored at `data/rune.db`. |
| Illustrations | Rough.js | Client-side SVG rendering from agent-produced illustration specs (JSON stored in DB). |
| Auth | Cloudflare Access | Zero-trust policy enforced at the edge. Free for up to 50 users. |
| Tunnel | cloudflared | Outbound-only QUIC connection. Remotely-managed via dashboard token. |
| Process Manager | systemd | Service file for the gateway process. |
| CLI | Commander.js + Inquirer.js | Interactive setup wizard, service management. |
| PWA | next-pwa / Serwist | Service worker, manifest, offline support, add-to-homescreen. |

### AI Gateway + Fallback Configuration

Two **independent code paths** exist for DeepSeek calls. The user configures priority order in settings.

```typescript
import { streamText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';

// Path A: Vercel AI Gateway (no DeepSeek API key needed for this path)
function gatewayModel(modelId: string) {
  // AI Gateway resolves provider routing. Model string format: 'deepseek/deepseek-v4-pro'
  return `deepseek/${modelId}`;
}

// Path B: Direct DeepSeek API (bypasses AI Gateway entirely)
const directDeepSeek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});
function directModel(modelId: string) {
  return directDeepSeek(modelId); // e.g., directDeepSeek('deepseek-v4-pro')
}

// Fallback wrapper — tries primary, falls back on failure
async function callWithFallback(modelId: string, options: object) {
  const settings = getSettings();
  const primary = settings.aiProviderPriority === 'gateway_first'
    ? () => gatewayModel(modelId)
    : () => directModel(modelId);
  const fallback = settings.aiProviderPriority === 'gateway_first'
    ? () => directModel(modelId)
    : () => gatewayModel(modelId);

  try {
    return await streamText({ model: primary(), ...options });
  } catch (err) {
    console.warn(`Primary provider failed, falling back:`, err);
    return await streamText({ model: fallback(), ...options });
  }
}
```

This ensures the app still works if either the AI Gateway or the direct DeepSeek API is down.

### Embedding Configuration

Voyage 4 models are available through the Vercel AI Gateway. The AI Gateway handles authentication and routing — add your Voyage API key in the AI Gateway dashboard settings, then use model strings directly:

```typescript
import { embed, embedMany } from 'ai';

// At save time — embed the item's content/summary with voyage-4 via AI Gateway
const { embedding } = await embed({
  model: 'voyage/voyage-4',
  value: itemSummary,
  providerOptions: {
    voyage: { inputType: 'document', outputDimension: 1024 },
  },
});

// At search time — embed the user's query with voyage-4-lite (lighter, faster)
const { embedding: queryEmbedding } = await embed({
  model: 'voyage/voyage-4-lite',
  value: searchQuery,
  providerOptions: {
    voyage: { inputType: 'query', outputDimension: 1024 },
  },
});
```

All voyage-4 series models produce compatible embeddings in a shared embedding space. Using `voyage-4` (heavier) for documents and `voyage-4-lite` (lighter) for queries is cost-efficient without sacrificing retrieval quality. Model IDs available through AI Gateway: `voyage/voyage-4-large`, `voyage/voyage-4`, `voyage/voyage-4-lite`.

---

## 4. Project Structure

```
rune/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout (PWA shell, fonts, theme)
│   │   ├── page.tsx                  # For You feed (default view)
│   │   ├── all/
│   │   │   └── page.tsx              # All items view
│   │   ├── tag/
│   │   │   └── [slug]/page.tsx       # Items filtered by tag
│   │   ├── item/
│   │   │   └── [id]/page.tsx         # Full-screen item view + summary modes
│   │   ├── settings/
│   │   │   └── page.tsx              # Tag management, API priority, preferences
│   │   └── api/
│   │       ├── items/
│   │       │   ├── route.ts          # GET (list/search), POST (manual add)
│   │       │   └── [id]/
│   │       │       ├── route.ts      # GET, PATCH (read/pin), DELETE
│   │       │       └── summary/
│   │       │           └── route.ts  # GET/POST summary by mode
│   │       ├── chat/
│   │       │   └── route.ts          # Rune Agent streaming endpoint
│   │       ├── feed/
│   │       │   └── route.ts          # For You scored feed
│   │       ├── tags/
│   │       │   └── route.ts          # CRUD tags
│   │       └── settings/
│   │           └── route.ts          # App settings
│   │
│   ├── components/
│   │   ├── card.tsx                  # Item card with Rough.js illustration
│   │   ├── card-grid.tsx             # Responsive masonry/grid layout
│   │   ├── search-bar.tsx            # Top search bar
│   │   ├── tag-nav.tsx               # Horizontal tag tabs
│   │   ├── filters.tsx               # Unread/pinned filter controls
│   │   ├── agent-panel.tsx           # Slide-out side panel for Rune Agent
│   │   ├── chat-message.tsx          # Chat bubble component
│   │   ├── summary-viewer.tsx        # Summary mode selector + content
│   │   ├── illustration.tsx          # Client-side Rough.js renderer
│   │   └── shimmer.tsx               # Loading skeleton animation
│   │
│   ├── hooks/
│   │   ├── use-feed.ts               # SWR/React Query for feed data
│   │   ├── use-agent-chat.ts         # useChat from AI SDK for agent panel
│   │   └── use-summary.ts            # Fetch/cache summary modes
│   │
│   ├── server/
│   │   ├── gateway.ts                # Main entry: starts Next.js + Discord + workers
│   │   └── discord.ts                # Chat SDK bot setup and message handlers
│   │
│   ├── agents/
│   │   ├── rune.ts                   # Rune Agent definition (ToolLoopAgent)
│   │   ├── librarian.ts              # Librarian Agent definition
│   │   ├── summary.ts                # Summary Agent definition
│   │   └── tools/
│   │       ├── semantic-search.ts    # Vector similarity search over items
│   │       ├── web-search.ts         # Exa search wrapper
│   │       ├── web-fetch.ts          # Exa content fetch wrapper
│   │       ├── save-item.ts          # Persist item to DB
│   │       ├── get-item.ts           # Retrieve item by ID
│   │       └── list-items.ts         # Query items with filters
│   │
│   ├── pipeline/
│   │   ├── capture.ts                # Orchestrates the full capture flow
│   │   ├── detect-platform.ts        # URL → platform classification
│   │   ├── fetch-youtube.ts          # SupaData → yt-dlp+Deepgram fallback
│   │   ├── fetch-video.ts            # yt-dlp + Deepgram for non-YouTube
│   │   ├── fetch-web.ts              # Exa content extraction
│   │   └── embed-item.ts             # Generate and store Voyage embedding
│   │
│   ├── feed/
│   │   └── score.ts                  # For You scoring algorithm
│   │
│   ├── db/
│   │   ├── schema.ts                 # Drizzle schema definitions
│   │   ├── migrate.ts                # Migration runner
│   │   ├── client.ts                 # Database connection singleton
│   │   └── migrations/               # Generated SQL migration files
│   │
│   └── lib/
│       ├── config.ts                 # Loads .env + settings from DB
│       ├── cosine.ts                 # Cosine similarity for embeddings
│       └── constants.ts              # Default tags, model IDs, etc.
│
├── cli/
│   ├── index.ts                      # CLI entry point (Commander)
│   ├── setup.ts                      # Full setup wizard
│   ├── setup-api.ts                  # API key re-configuration
│   ├── setup-discord.ts              # Discord-specific settings
│   └── service.ts                    # systemd start/stop/restart
│
├── public/
│   ├── manifest.json                 # PWA manifest
│   ├── sw.js                         # Service worker (generated)
│   └── icons/                        # PWA icons (192, 512)
│
├── data/                             # Runtime data (gitignored)
│   ├── rune.db                       # SQLite database
│   └── media/                        # Downloaded audio/video files
│
├── systemd/
│   └── rune.service                  # systemd unit file template
│
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env                              # Created by CLI setup (gitignored)
```

---

## 5. Data Schema

### `items`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PRIMARY KEY | ULID (time-sortable) |
| `url` | `text` NOT NULL | Original shared URL |
| `platform` | `text` NOT NULL | `youtube`, `x`, `instagram`, `reddit`, `producthunt`, `web` |
| `content_type` | `text` NOT NULL | `video`, `article`, `tweet`, `thread`, `post`, `audio` |
| `title` | `text` NOT NULL | AI-generated by Librarian |
| `meta_summary` | `text` NOT NULL | Short summary for AI context and semantic search |
| `meta_keywords` | `text` NOT NULL | JSON array of 5 keywords |
| `content` | `text` | Full text / transcript |
| `user_context` | `text` | Optional note the user added when sharing |
| `illustration` | `text` | JSON illustration spec for Rough.js rendering |
| `embedding` | `blob` | 1024-dim float32 vector (4096 bytes) |
| `status` | `text` NOT NULL DEFAULT `'unread'` | `unread` or `read` |
| `pinned` | `integer` NOT NULL DEFAULT `0` | Boolean flag |
| `read_at` | `integer` | Unix timestamp, NULL if unread |
| `created_at` | `integer` NOT NULL | Unix timestamp |
| `updated_at` | `integer` NOT NULL | Unix timestamp |

### `tags`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `integer` PRIMARY KEY | Auto-increment |
| `name` | `text` NOT NULL UNIQUE | Display name |
| `slug` | `text` NOT NULL UNIQUE | URL-safe identifier |
| `is_default` | `integer` NOT NULL DEFAULT `0` | True for built-in tags |
| `created_at` | `integer` NOT NULL | Unix timestamp |

Default tags seeded on first run: `SEO`, `AI`, `SaaS`, `Dev`, `Design`, `Startup`, `Marketing`, `Productivity`.

### `item_tags`

| Column | Type | Notes |
|--------|------|-------|
| `item_id` | `text` NOT NULL | FK → items.id |
| `tag_id` | `integer` NOT NULL | FK → tags.id |

Composite primary key on `(item_id, tag_id)`.

### `summaries`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `integer` PRIMARY KEY | Auto-increment |
| `item_id` | `text` NOT NULL | FK → items.id |
| `mode` | `text` NOT NULL | `short`, `five_points`, `eli5`, `devils_advocate` |
| `content` | `text` NOT NULL | Generated summary text |
| `created_at` | `integer` NOT NULL | Unix timestamp |

Unique constraint on `(item_id, mode)`. Once generated, never regenerated.

### `conversations`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PRIMARY KEY | ULID |
| `source` | `text` NOT NULL | `web` or `discord` |
| `context_item_id` | `text` | FK → items.id, nullable. Set when chat opened from an item. |
| `created_at` | `integer` NOT NULL | Unix timestamp |

### `messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | `text` PRIMARY KEY | ULID |
| `conversation_id` | `text` NOT NULL | FK → conversations.id |
| `role` | `text` NOT NULL | `user` or `assistant` |
| `content` | `text` NOT NULL | Message text |
| `created_at` | `integer` NOT NULL | Unix timestamp |

### `settings`

| Column | Type | Notes |
|--------|------|-------|
| `key` | `text` PRIMARY KEY | Setting name |
| `value` | `text` NOT NULL | JSON-encoded value |

Settings include: `ai_provider_priority` (`"gateway_first"` or `"direct_first"`), `default_summary_mode`, `theme_preferences`.

### Drizzle Schema (src/db/schema.ts)

```typescript
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
  itemId: text('item_id').notNull().references(() => items.id),
  tagId: integer('tag_id').notNull().references(() => tags.id),
}, (table) => ({
  pk: primaryKey({ columns: [table.itemId, table.tagId] }),
}));

export const summaries = sqliteTable('summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  itemId: text('item_id').notNull().references(() => items.id),
  mode: text('mode').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  uniqueItemMode: uniqueIndex('idx_summaries_item_mode').on(table.itemId, table.mode),
}));

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  source: text('source').notNull(),
  contextItemId: text('context_item_id').references(() => items.id),
  createdAt: integer('created_at').notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});
```

### Indexes

```sql
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_platform ON items(platform);
CREATE INDEX idx_items_created_at ON items(created_at);
CREATE INDEX idx_items_read_at ON items(read_at);
CREATE INDEX idx_items_pinned ON items(pinned);
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
```

### Embedding Storage and Retrieval

Embeddings are stored as raw `Float32Array` buffers in the `embedding` BLOB column. Vector similarity search runs in application code, not SQL:

```typescript
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

For the expected scale (personal archive, likely <10,000 items), loading all embeddings into memory and computing cosine similarity in JS is fast enough (<50ms). No vector database needed.

---

## 6. Agent Designs

### 6a. Rune Agent (Main Conversational Agent)

**Model:** DeepSeek V4 Pro (`deepseek/deepseek-v4-pro`)

**Role:** The primary agent the user talks to in the web app side panel and via Discord. Has full access to the saved archive. Can search by topic, date, or category. Can call the Librarian to save new items.

**System Prompt:**

```
You are Rune, a personal knowledge assistant. You have access to the user's
saved content archive — articles, videos, tweets, and posts collected from
across the web.

Your job is to help the user recall, explore, and think about the things
they've saved. You can search their archive semantically, retrieve specific
items, and answer questions using saved content as context.

When the user shares a link or asks you to save something, delegate to the
Librarian by calling the save_item tool with the URL and any context the
user provides.

When the user asks a question that their archive can't answer, use the
web_search and web_fetch tools to find current information.

Cite saved items by title when referencing them. Be concise and direct.
```

**Tools:**

| Tool | Description |
|------|-------------|
| `semantic_search` | Embed the query with voyage-4-lite, compute cosine similarity against all item embeddings, return top-K items |
| `web_search` | Call Exa `/search` with the query. Returns titles, URLs, and highlights. |
| `web_fetch` | Call Exa `/contents` to fetch full text from a URL. |
| `get_item` | Retrieve a single item by ID with full content. |
| `list_items` | Query items with filters: tag, platform, status, date range, pinned. |
| `save_item` | Trigger the Librarian Agent capture pipeline for a given URL + optional user context. Returns the created item. |

**Implementation:**

```typescript
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

export const runeAgent = new ToolLoopAgent({
  model: 'deepseek/deepseek-v4-pro', // Resolved via callWithFallback at call sites
  instructions: RUNE_SYSTEM_PROMPT,
  tools: {
    semantic_search: tool({
      description: 'Search the saved archive by meaning. Returns the most relevant saved items.',
      inputSchema: z.object({
        query: z.string().describe('Natural language search query'),
        limit: z.number().optional().default(5),
      }),
      execute: async ({ query, limit }) => { /* embed query, compute similarity, return top items */ },
    }),
    web_search: tool({ /* Exa search */ }),
    web_fetch: tool({ /* Exa content fetch */ }),
    get_item: tool({ /* DB lookup by ID */ }),
    list_items: tool({ /* DB query with filters */ }),
    save_item: tool({
      description: 'Save a new item to the archive. Delegates to the Librarian for processing.',
      inputSchema: z.object({
        url: z.string().url(),
        context: z.string().optional().describe('Additional context from the user about why they are saving this'),
      }),
      execute: async ({ url, context }) => { /* trigger capture pipeline */ },
    }),
  },
});
```

### 6b. Librarian Agent (Content Cataloging)

**Model:** DeepSeek V4 Pro (`deepseek/deepseek-v4-pro`)

**Role:** Called by the Rune Agent (or directly by the capture pipeline) when a user saves content. Responsible for writing the title, meta summary, 5 keywords, assigning tags, and creating the illustration spec. Also responsible for fetching content when automated methods fail.

**System Prompt:**

```
You are the Librarian, an internal agent responsible for cataloging saved
content. When given a URL and its fetched content, you must:

1. Write a concise, descriptive title (max 80 chars).
2. Write a meta summary (2-3 sentences) optimized for semantic search.
   It should capture the core topic, key claims, and relevance.
3. Generate exactly 5 keywords as a JSON array of strings.
4. Assign 1-3 tags from the available tag list.
5. Create an illustration spec for a hand-drawn sketch that represents
   the content visually.

If the content was not successfully fetched by the automated pipeline,
use the web_fetch tool to retrieve it yourself. Try the original URL
first. If that fails, try fetching a cached or alternative version.

Do not search for related content. Your job is strictly to catalog
what the user has shared.
```

**Tools:**

| Tool | Description |
|------|-------------|
| `web_fetch` | Exa content fetch. Fallback when automated fetching fails. |

The Librarian does NOT have `web_search` — deliberately restricted to prevent it from wandering off to search for related content when it should only be cataloging the shared item. The Librarian does NOT have a `generate_illustration` tool — the illustration spec is part of its structured output (via `generateObject` with the `catalogSchema`), not a separate tool call.

**Illustration Spec Format:**

The Librarian outputs a JSON object that the client renders with Rough.js:

```typescript
interface IllustrationSpec {
  background: string;          // hex color
  elements: IllustrationElement[];
}

type IllustrationElement =
  | { type: 'circle'; x: number; y: number; diameter: number; fill?: string; stroke?: string }
  | { type: 'rectangle'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string }
  | { type: 'line'; x1: number; y1: number; x2: number; y2: number; stroke?: string }
  | { type: 'ellipse'; x: number; y: number; width: number; height: number; fill?: string; stroke?: string }
  | { type: 'path'; d: string; fill?: string; stroke?: string }
  | { type: 'text'; x: number; y: number; content: string; fontSize?: number; fill?: string };
```

Canvas is 200x140 (card aspect ratio). The Librarian uses simple geometric shapes to create an abstract, thematic sketch — e.g., a video icon for YouTube content, stacked rectangles for articles, circuit-like patterns for tech topics. The `text` element is rendered with a handwriting-style font, not by Rough.js.

**Structured Output:**

The Librarian's final output is extracted via `generateObject` to ensure correct structure:

```typescript
const catalogSchema = z.object({
  title: z.string().max(80),
  metaSummary: z.string(),
  keywords: z.array(z.string()).length(5),
  tagSlugs: z.array(z.string()).min(1).max(3),
  illustration: illustrationSpecSchema,
});
```

### 6c. Summary Agent (On-Demand Item Summaries)

**Model:** DeepSeek V4 Flash (`deepseek/deepseek-v4-flash`)

**Role:** Generates summaries when a user opens an item and selects a mode. Not called at save time. Uses the faster Flash model since the task is straightforward. Once generated, summaries are cached in the `summaries` table.

**Modes and System Prompts:**

| Mode | Slug | System Prompt |
|------|------|---------------|
| Short Summary | `short` | "Summarize the following content in 1-3 concise paragraphs. Focus on the main argument, key findings, and practical takeaways." |
| Five Points | `five_points` | "Distill the following content into exactly 5 tight bullet points. Each bullet should capture one key idea. No preamble." |
| Explain Like I'm 5 | `eli5` | "Explain the following content as if you're talking to a curious beginner with no background in this topic. Use simple language, analogies, and short sentences. Avoid jargon." |
| Devil's Advocate | `devils_advocate` | "Present two opposing perspectives on the following content. For each side, give a clear argument with supporting reasoning. Be fair and rigorous with both positions. If the content covers a topic beyond your knowledge cutoff, use the web_search tool to find current counterarguments." |

**Tools:**

| Tool | Description |
|------|-------------|
| `web_search` | Exa search. Useful for Devil's Advocate (finding opposing views) and for topics after the model's knowledge cutoff. |
| `web_fetch` | Exa content fetch. Retrieve full text from search results. |

**Common Suffix for All Mode Prompts:**

```
Rely primarily on the provided source content. However, if the content
references events, research, or claims that may be after your knowledge
cutoff, you may use web_search to verify or find additional context.
Do not invent facts.
```

**Implementation Flow:**

```
1. User opens item → client requests GET /api/items/[id]/summary?mode=short
2. Server checks summaries table for existing (item_id, mode) match
3. If cached → return immediately
4. If not cached → call Summary Agent:
   a. Build prompt: system prompt (mode-specific) + full item content
   b. Use streamText for real-time streaming to client
   c. On completion, persist to summaries table
5. Client shows shimmer animation while streaming
```

### Agent Model Helper

Uses the `callWithFallback` pattern defined in §3. Each agent references a model ID and the helper resolves which path (Gateway or Direct) to try first based on the user's settings. See the fallback wrapper in the Technology Stack section for the full implementation.

---

## 7. Capture Pipeline

The capture pipeline runs when a user shares a link (via Discord or the web app). It orchestrates content fetching, metadata generation, embedding, and storage.

### Flow Diagram

```
User shares URL + optional context
        │
        ▼
┌─────────────────────┐
│ detect-platform.ts  │  Classify URL → platform + content_type
│ (regex matching)    │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐     ┌──────────────────┐
│ Content Fetch       │     │ Platform Routing  │
│ (platform-specific) ├────►│                  │
└─────────────────────┘     │ YouTube:          │
                            │   1. SupaData API │
                            │   2. yt-dlp +     │
                            │      Deepgram     │
                            │                   │
                            │ Web (articles):   │
                            │   1. Exa /contents│
                            │                   │
                            │ Other video:      │
                            │   1. yt-dlp +     │
                            │      Deepgram     │
                            │                   │
                            │ X/Reddit/etc:     │
                            │   1. Exa /contents│
                            └────────┬──────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ Librarian Agent  │  If automated fetch failed,
                            │ (metadata gen)   │  Librarian uses web_fetch
                            │                  │  tool as fallback.
                            │ Outputs:         │
                            │  - title         │
                            │  - meta_summary  │
                            │  - keywords [5]  │
                            │  - tag slugs     │
                            │  - illustration  │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ embed-item.ts    │  Embed meta_summary with
                            │ (Voyage 4)       │  voyage-4, input_type:
                            │                  │  'document', 1024 dims
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │ Store to SQLite  │  Insert item row with all
                            │ + link tags      │  fields + embedding blob
                            └──────────────────┘
```

### Platform Detection (`detect-platform.ts`)

```typescript
interface PlatformResult {
  platform: 'youtube' | 'x' | 'instagram' | 'reddit' | 'producthunt' | 'web';
  contentType: 'video' | 'article' | 'tweet' | 'thread' | 'post' | 'audio';
  videoId?: string; // For YouTube
}

const PLATFORM_PATTERNS: [RegExp, PlatformResult['platform'], PlatformResult['contentType']][] = [
  [/(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts)/, 'youtube', 'video'],
  [/(?:x\.com|twitter\.com)\/\w+\/status/, 'x', 'tweet'],
  [/instagram\.com\/(?:p|reel)\//, 'instagram', 'post'],
  [/reddit\.com\/r\/\w+\/comments/, 'reddit', 'thread'],
  [/producthunt\.com\/posts\//, 'producthunt', 'post'],
];
```

### YouTube Fetch (`fetch-youtube.ts`)

```
Step 1: Try SupaData
  GET https://api.supadata.ai/v1/transcript?url={url}
  Headers: x-api-key: {SUPADATA_API_KEY}

  Success → join transcript segments into full text
  Failure → Step 2

Step 2: yt-dlp + Deepgram
  a. Run: yt-dlp -x --audio-format wav -o "data/media/{id}.%(ext)s" {url}
  b. Read the audio file
  c. Call Deepgram pre-recorded transcription:
     POST https://api.deepgram.com/v1/listen?model=nova-3&language=en
     Headers: Authorization: Token {DEEPGRAM_API_KEY}
     Body: audio file buffer
  d. Extract transcript text from response
  e. Clean up audio file after transcription

  Failure → pass null content to Librarian, let it try web_fetch
```

### Non-YouTube Video Fetch (`fetch-video.ts`)

Identical to YouTube Step 2 (yt-dlp + Deepgram). yt-dlp supports 1000+ platforms. The pipeline:
1. Download audio with yt-dlp
2. Transcribe with Deepgram Nova-3
3. Return transcript text

### Web Content Fetch (`fetch-web.ts`)

```typescript
import Exa from 'exa-js';

const exa = new Exa(process.env.EXA_API_KEY);

async function fetchWebContent(url: string): Promise<string | null> {
  const result = await exa.getContents([url], {
    text: true,
  });
  return result.results[0]?.text ?? null;
}
```

### Capture Orchestrator (`capture.ts`)

```typescript
async function captureItem(url: string, userContext?: string): Promise<Item> {
  const platform = detectPlatform(url);

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
    content = await fetchVideo(url);
  }

  // 3. Call Librarian Agent to generate metadata
  const catalog = await runLibrarian(url, content, userContext, availableTags);

  // 4. Embed the meta summary via AI Gateway
  const { embedding } = await embed({
    model: 'voyage/voyage-4',
    value: catalog.metaSummary,
    providerOptions: { voyage: { inputType: 'document', outputDimension: 1024 } },
  });

  // 5. Store in database
  const item = await db.insert(items).values({
    id: ulid(),
    url,
    platform: platform.platform,
    contentType: platform.contentType,
    title: catalog.title,
    metaSummary: catalog.metaSummary,
    metaKeywords: JSON.stringify(catalog.keywords),
    content: content ?? catalog.fetchedContent,
    userContext,
    illustration: JSON.stringify(catalog.illustration),
    embedding: Buffer.from(new Float32Array(embedding).buffer),
    status: 'unread',
    pinned: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }).returning();

  // 6. Link tags
  for (const slug of catalog.tagSlugs) {
    const tag = await db.select().from(tags).where(eq(tags.slug, slug)).get();
    if (tag) {
      await db.insert(itemTags).values({ itemId: item.id, tagId: tag.id });
    }
  }

  return item;
}
```

---

## 8. For You Algorithm

The For You feed scores all **unread** items and returns them in ranked order. It runs once per page load and the result is held for the entire session. Recomputation happens only on full page reload or pull-to-refresh (mobile PWA).

### Scoring Signals

Each unread item receives a score computed from five signals:

```
score(item) = w1 * recency_similarity
            + w2 * tag_affinity
            + w3 * pinned_similarity
            + w4 * recency_boost
            - w5 * staleness_penalty
```

**Weights (tunable in constants.ts):**

```typescript
const FEED_WEIGHTS = {
  recencySimilarity: 0.35,
  tagAffinity: 0.20,
  pinnedSimilarity: 0.25,
  recencyBoost: 0.10,
  stalenessPenalty: 0.10,
};
```

### Signal Computation

#### Signal 1: Recency of Related Reads (`recency_similarity`)

Items semantically similar to things read in the last 7 days.

```
1. Fetch all items where read_at > (now - 7 days) and status = 'read'.
2. Collect their embeddings into a set R.
3. For each unread item U:
   recency_similarity(U) = max(cosine_similarity(U.embedding, r) for r in R)
4. Normalize to [0, 1] across all unread items.
```

Using `max` rather than `mean` — an item highly relevant to even one recent read should score high.

#### Signal 2: Tag Affinity (`tag_affinity`)

Tags from recently read items weight items sharing those tags.

```
1. Fetch tags of all items read in the last 7 days.
2. Count tag frequency → tag_weights map (normalized to sum to 1).
3. For each unread item U:
   tag_affinity(U) = sum(tag_weights[t] for t in U.tags if t in tag_weights)
4. Normalize to [0, 1].
```

#### Signal 3: Pinned Item Similarity (`pinned_similarity`)

Semantic proximity to pinned items signals strong user interest.

```
1. Fetch all items where pinned = 1.
2. Collect their embeddings into a set P.
3. For each unread item U:
   pinned_similarity(U) = max(cosine_similarity(U.embedding, p) for p in P)
   If no pinned items exist, this signal is 0 for all items.
4. Normalize to [0, 1].
```

#### Signal 4: Recency of Save (`recency_boost`)

Newly saved items get a small boost so fresh content is visible.

```
recency_boost(U) = exp(-λ * days_since_saved(U))
where λ = 0.1 (half-life ≈ 7 days)
```

Already in [0, 1] range.

#### Signal 5: Staleness Penalty (`staleness_penalty`)

Long-unread items are penalized to prevent the feed from stagnating.

```
staleness_penalty(U) = 1 - exp(-μ * days_since_saved(U))
where μ = 0.02 (reaches ~50% penalty at 35 days)
```

Already in [0, 1] range.

### Diversity Enforcement

After scoring, the ranked list is reshuffled for diversity:

```
1. Sort all unread items by score descending.
2. Build the output list greedily:
   - For each position, pick the highest-scoring item that does not
     violate constraints:
     a. No single tag occupies more than 1/3 of items selected so far.
     b. No two consecutive items share the same primary tag.
   - If all remaining items would violate, relax the consecutive constraint
     and fill from the top of the remaining list.
3. Within each category/tag view, apply the same interleaving: items from
   different source platforms and topics alternate.
```

### Pagination and Session Caching

The feed API returns the full scored + diversified list of item IDs in one response. The client caches this list in a React `useRef` inside the feed page component, initialized on first mount. Pagination is local: the component tracks a `page` counter in state and slices the cached list (e.g., 20 items per page). Scrolling to load more increments the page — no API call. The ref is discarded and re-fetched only on:

- **Full page reload** (browser refresh or navigation away and back)
- **Pull-to-refresh** on mobile PWA (detected via a touch gesture handler at scroll position 0)

The ref is NOT cleared on navigating to an item and back — React keeps the component mounted or the ref survives via layout-level state. This matches the spec requirement that "items do not disappear or shift position between visits to individual items."

### API Endpoint

```
GET /api/feed

Response: {
  items: [
    { id, title, platform, tags, illustration, status, pinned, createdAt },
    ...
  ]
}
```

No visible algorithm UI. No explanation of why items were surfaced. The feed should feel like a well-ordered collection.

---

## 9. Web Application

### Pages

#### For You (`/` — default)

- Search bar at the top
- Horizontal tag nav: `For You`, `All`, `SEO`, `AI`, `SaaS`, `Dev`, `Design`, `Startup`, `Marketing`, `Productivity`, + user tags
- Filter pills: `Unread`, `Pinned`
- Card grid showing scored feed
- Each card: Rough.js illustration + title + platform icon + tags
- Unread cards are bright; read cards are dimmed (reduced opacity)
- Infinite scroll with local pagination from session-cached feed

#### All Items (`/all`)

- Same layout as For You, but items sorted reverse-chronologically
- No scoring applied

#### Tag View (`/tag/[slug]`)

- Same layout, filtered to items with the given tag
- Diversity interleaving still applies within the tag

#### Item View (`/item/[id]`)

- Full-screen view of a single item
- Header: title, platform, source URL (copyable), tags, save date
- Body: full content (article text or transcript)
- Summary mode selector: `Short Summary`, `Five Points`, `Explain Like I'm 5`, `Devil's Advocate`
  - User's preferred mode loads immediately on open (shimmer while streaming)
  - Switching modes triggers generation if not cached, instant display if cached
- Opening an item marks it as `read` (PATCH /api/items/[id] with status: 'read')
- Agent panel can be opened as a slide-out. Current item is auto-injected into chat context.

#### Settings (`/settings`)

- Tag management: create, rename, delete custom tags
- API priority toggle: Gateway First vs Direct First
- Default summary mode selection

### Agent Side Panel

- Slide-out panel on the right (desktop) or bottom sheet (mobile)
- Chat interface using AI SDK `useChat` hook connected to `/api/chat`
- When opened from an item, the item's content is pre-loaded as context. User sees a chip showing the item title and can remove it.
- Conversation history persists in the `conversations` and `messages` tables
- Streaming responses via `streamText` / `toUIMessageStreamResponse()`

### PWA Configuration

```json
// public/manifest.json
{
  "name": "Rune",
  "short_name": "Rune",
  "description": "Your personal second brain",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#f5e6d3",
  "theme_color": "#2c1810",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

The service worker caches the app shell and static assets for offline access. API requests are network-first.

### Visual Design Direction

- **Palette:** Warm tones — cream/parchment backgrounds (`#f5e6d3`), dark brown text (`#2c1810`), muted accent colors for tags
- **Typography:** Serif or slab-serif for headings (literary, hand-crafted feel), monospace or rounded sans for body
- **Cards:** Paper-textured background, subtle drop shadow, Rough.js illustration as top banner, title below, tag pills, platform icon
- **Overall feel:** Sketchbook / collector's cabinet. Not a SaaS dashboard.

### Illustration Rendering (Client-Side)

Cards render illustrations client-side using Rough.js from the stored JSON spec:

```typescript
// components/illustration.tsx
import rough from 'roughjs';

function Illustration({ spec }: { spec: IllustrationSpec }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !spec) return;
    const rc = rough.svg(svgRef.current);
    svgRef.current.innerHTML = '';

    for (const el of spec.elements) {
      let node: SVGElement;
      switch (el.type) {
        case 'circle':
          node = rc.circle(el.x, el.y, el.diameter, { fill: el.fill, stroke: el.stroke });
          break;
        case 'rectangle':
          node = rc.rectangle(el.x, el.y, el.width, el.height, { fill: el.fill, stroke: el.stroke });
          break;
        case 'line':
          node = rc.line(el.x1, el.y1, el.x2, el.y2, { stroke: el.stroke });
          break;
        case 'ellipse':
          node = rc.ellipse(el.x, el.y, el.width, el.height, { fill: el.fill, stroke: el.stroke });
          break;
        case 'path':
          node = rc.path(el.d, { fill: el.fill, stroke: el.stroke });
          break;
        // 'text' elements rendered as <text> SVG elements, not via Rough.js
      }
      svgRef.current.appendChild(node);
    }
  }, [spec]);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 140"
      style={{ background: spec.background }}
    />
  );
}
```

---

## 10. Discord Bot

### Setup

```typescript
// src/server/discord.ts
import { Chat } from 'chat';
import { createDiscordAdapter } from '@chat-adapter/discord';
import { runeAgent } from '../agents/rune';

export function createBot() {
  const bot = new Chat({
    userName: 'rune',
    adapters: {
      discord: createDiscordAdapter(),
    },
  });

  bot.onNewMention(async (thread) => {
    await thread.subscribe();

    const userMessage = thread.latestMessage.text;
    const conversationId = thread.id;

    // Persist conversation
    await ensureConversation(conversationId, 'discord');

    // Get conversation history
    const history = await getMessages(conversationId);

    // Generate response with Rune Agent
    const result = await runeAgent.generate({
      messages: [
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
      ],
    });

    // Persist messages
    await saveMessage(conversationId, 'user', userMessage);
    await saveMessage(conversationId, 'assistant', result.text);

    // Send response (Chat SDK uses post+edit for Discord — no native streaming)
    await thread.post({ text: result.text });
  });

  return bot;
}
```

### Gateway Listener

The Discord adapter uses `startGatewayListener()` to connect via WebSocket to the Discord Gateway. No public webhook URL is needed — the connection is outbound-only from the VPS.

```typescript
// src/server/gateway.ts
const bot = createBot();

// Start the WebSocket connection to Discord
await bot.adapters.discord.startGatewayListener();
```

The gateway listener maintains the WebSocket and forwards events to the bot's message handlers. It handles reconnection automatically.

### Environment Variables

```
DISCORD_BOT_TOKEN=...
DISCORD_PUBLIC_KEY=...
DISCORD_APPLICATION_ID=...
```

### User Interaction Patterns

1. **Saving content:** User sends a message containing a URL → Rune detects the link and calls `save_item` → responds with confirmation and the generated title.
2. **Chatting:** User sends a question → Rune searches the archive and/or the web → responds conversationally.
3. **Adding context:** User sends "save [url] — this is about X" → the text after the URL is passed as `userContext` to the Librarian.

---

## 11. CLI Tool

### Entry Point

The CLI is built with Commander.js and compiled as a standalone binary (or run via `npx rune` / `node cli/index.ts`).

```
rune setup          Full setup wizard
rune setup api      Re-configure API keys
rune setup discord  Re-configure Discord settings
rune start          Start the gateway service
rune restart        Restart the gateway service
rune stop           Stop the gateway service
```

### `rune setup` — Full Setup Wizard

Interactive prompts using Inquirer.js:

```
Step 1: Check Dependencies
  ├── Node.js ≥ 20        → install via nvm if missing
  ├── yt-dlp              → install via pip or binary if missing
  ├── ffmpeg              → install via apt/yum if missing
  └── cloudflared         → install via apt repo if missing

Step 2: API Keys (prompted one by one, skip = keep existing)
  ├── VERCEL_AI_GATEWAY_KEY   "Vercel AI Gateway API key"
  ├── DEEPSEEK_API_KEY        "DeepSeek API key (fallback)"
  ├── EXA_API_KEY             "Exa API key (web search)"
  ├── VOYAGE_API_KEY          "Voyage AI API key (embeddings)"
  ├── DEEPGRAM_API_KEY        "Deepgram API key (transcription)"
  └── SUPADATA_API_KEY        "SupaData API key (YouTube transcripts)"

Step 3: Discord Configuration
  ├── DISCORD_BOT_TOKEN
  ├── DISCORD_PUBLIC_KEY
  └── DISCORD_APPLICATION_ID

Step 4: Cloudflare Tunnel (optional)
  ├── Prompt: "Configure Cloudflare Tunnel? (y/n)"
  ├── If yes:
  │   ├── Run: cloudflared tunnel login
  │   ├── Run: cloudflared tunnel create rune
  │   ├── Prompt for hostname (e.g., rune.yourdomain.com)
  │   ├── Write tunnel config to ~/.cloudflared/config.yml
  │   └── Install cloudflared as systemd service
  └── If no: skip, user sets up manually

Step 5: Write Configuration
  ├── Write .env file with all keys
  ├── Initialize SQLite database (run migrations)
  └── Seed default tags

Step 6: Install systemd Service
  ├── Write rune.service to /etc/systemd/system/
  ├── systemctl daemon-reload
  └── systemctl enable rune
```

### `rune setup api`

Re-prompts for all API keys except Discord. For each key, shows the current value (masked) and allows override or skip.

### `rune setup discord`

Re-prompts for Discord-specific settings only: bot token, public key, application ID.

### `rune start` / `rune restart` / `rune stop`

```typescript
import { execSync } from 'child_process';

function start() { execSync('sudo systemctl start rune'); }
function restart() { execSync('sudo systemctl restart rune'); }
function stop() { execSync('sudo systemctl stop rune'); }
```

### systemd Service File

```ini
# systemd/rune.service
[Unit]
Description=Rune Gateway
After=network.target

[Service]
Type=simple
User=rune
Group=rune
WorkingDirectory=/opt/rune
ExecStart=/usr/bin/node /opt/rune/.next/standalone/server.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/rune/.env

[Install]
WantedBy=multi-user.target
```

---

## 12. VPS Deployment

### Prerequisites

- Ubuntu 22.04+ or Debian 12+ VPS
- 2 GB RAM minimum (SQLite + Node.js + yt-dlp)
- 20 GB disk (media storage)
- Cloudflare account with a domain

### Deployment Steps

```
1. SSH into VPS
2. Clone repository:
   git clone https://github.com/user/rune /opt/rune
   cd /opt/rune

3. Install dependencies:
   npm install

4. Build:
   npm run build    # Next.js standalone build

5. Run setup wizard:
   npx rune setup

6. Start:
   npx rune start

7. Verify:
   curl http://localhost:3000    # Should return the app
   systemctl status rune         # Should show active
   systemctl status cloudflared  # Should show tunnel active
```

### Cloudflare Tunnel Configuration

```yaml
# ~/.cloudflared/config.yml
tunnel: <TUNNEL_UUID>
credentials-file: /root/.cloudflared/<TUNNEL_UUID>.json

ingress:
  - hostname: rune.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Cloudflare Access Policy

Configured in the Cloudflare Zero Trust dashboard (not automated by CLI):

1. Go to Zero Trust → Access → Applications
2. Add application: Self-hosted, URL = `rune.yourdomain.com`
3. Add policy: Allow, with email = user's email address
4. Authentication: email OTP (simplest) or any identity provider

All requests to the app pass through Cloudflare Access first. The app itself has no authentication layer — Access handles it entirely.

### Next.js Standalone Build

```javascript
// next.config.ts
import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
};

export default config;
```

The standalone output produces a self-contained `server.js` in `.next/standalone/` that includes only the necessary Node.js modules. The gateway process starts this server along with the Discord bot and background workers.

### Custom Server Entry (`src/server/gateway.ts`)

```typescript
import next from 'next';
import { createServer } from 'http';
import { createBot } from './discord';
import { initDatabase } from '../db/client';

async function main() {
  // Initialize database
  await initDatabase();

  // Start Next.js
  const app = next({ dev: false });
  await app.prepare();
  const handle = app.getRequestHandler();

  const server = createServer((req, res) => handle(req, res));
  server.listen(3000, '127.0.0.1', () => {
    console.log('Rune gateway listening on http://127.0.0.1:3000');
  });

  // Start Discord bot
  const bot = createBot();
  await bot.adapters.discord.startGatewayListener();
  console.log('Discord gateway connected');
}

main().catch(console.error);
```

---

## 13. Environment Variables

All stored in `/opt/rune/.env`, managed by the CLI:

```bash
# AI Gateway (primary path for DeepSeek models)
VERCEL_AI_GATEWAY_KEY=

# DeepSeek (fallback / BYOK for gateway)
DEEPSEEK_API_KEY=

# Embeddings
VOYAGE_API_KEY=

# Web search and content fetch
EXA_API_KEY=

# YouTube transcripts (primary)
SUPADATA_API_KEY=

# Audio transcription (fallback for YouTube, primary for other video)
DEEPGRAM_API_KEY=

# Discord bot
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
DISCORD_APPLICATION_ID=

# Application
PORT=3000
DATA_DIR=/opt/rune/data
NODE_ENV=production
```

---

## 14. API Route Summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed` | Scored For You feed (full ranked item list) |
| GET | `/api/items` | List items with filters: `?tag=`, `?status=`, `?platform=`, `?q=` (semantic search), `?sort=` |
| POST | `/api/items` | Manually add an item (URL + optional context) |
| GET | `/api/items/[id]` | Get single item with full content |
| PATCH | `/api/items/[id]` | Update item: mark read, pin/unpin |
| DELETE | `/api/items/[id]` | Remove item from archive |
| GET | `/api/items/[id]/summary?mode=` | Get or generate summary for a mode |
| POST | `/api/chat` | Rune Agent streaming chat endpoint |
| GET | `/api/tags` | List all tags |
| POST | `/api/tags` | Create a tag |
| PATCH | `/api/tags/[id]` | Rename a tag |
| DELETE | `/api/tags/[id]` | Delete a tag |
| GET | `/api/settings` | Get all settings |
| PATCH | `/api/settings` | Update settings |

---

## 15. Implementation Order

### Phase 1: Foundation

1. Initialize Next.js project with TypeScript, Tailwind, standalone output
2. Set up Drizzle ORM with SQLite schema and migrations
3. Seed default tags
4. Set up environment config loading
5. Implement the Voyage embedding utility (`embed` / `embedMany` / `cosineSimilarity`)
6. Build the basic card grid UI with warm retro styling

### Phase 2: Capture Pipeline

7. Implement platform detection
8. Implement SupaData YouTube fetcher
9. Implement yt-dlp + Deepgram fallback fetcher
10. Implement Exa web content fetcher
11. Build the Librarian Agent with structured output
12. Build the Rough.js illustration renderer (client component)
13. Wire up the full capture orchestrator
14. Build POST `/api/items` endpoint

### Phase 3: Web App Core

15. Build the item list API with filters and semantic search
16. Build the For You scoring algorithm
17. Build all frontend pages: For You, All, Tag, Item, Settings
18. Build the tag navigation and filter controls
19. Implement read/unread state and card dimming
20. Implement pin/unpin functionality

### Phase 4: Agents

21. Build the Rune Agent with all tools
22. Build the Summary Agent with all four modes
23. Build the agent side panel UI with `useChat`
24. Build the summary viewer with mode switching and shimmer
25. Wire up item context injection in agent panel

### Phase 5: Discord Bot

26. Set up Chat SDK with Discord adapter
27. Implement message handler connecting to Rune Agent
28. Implement link detection and save flow
29. Test gateway listener WebSocket connection

### Phase 6: CLI and Deployment

30. Build CLI with Commander.js: setup, setup api, setup discord, start, stop, restart
31. Build the interactive setup wizard with dependency checks
32. Create the systemd service file template
33. Implement Cloudflare Tunnel setup (optional wizard step)
34. PWA configuration: manifest, service worker, icons
35. Test standalone build on VPS
36. End-to-end test: share link in Discord → item appears in web app → open and read summary → chat with agent about it
