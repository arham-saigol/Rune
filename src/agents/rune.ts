import { tool, streamText } from 'ai';
import { z } from 'zod';
import { semanticSearch } from './tools/semantic-search';
import { webSearch } from './tools/web-search';
import { webFetch } from './tools/web-fetch';
import { getItem, listItems } from './tools/list-items';
import { saveItem } from './tools/save-item';
import { getModel } from './model-helper';

const RUNE_SYSTEM_PROMPT = `You are Rune, a personal knowledge assistant. You have access to the user's saved content archive — articles, videos, tweets, and posts collected from across the web.

Your job is to help the user recall, explore, and think about the things they've saved. You can search their archive semantically, retrieve specific items, and answer questions using saved content as context.

When the user shares a link or asks you to save something, delegate to the Librarian by calling the save_item tool with the URL and any context the user provides.

When the user asks a question that their archive can't answer, use the web_search and web_fetch tools to find current information.

Cite saved items by title when referencing them. Be concise and direct.`;

export async function runRuneAgent(messages: { role: 'user' | 'assistant'; content: string }[]) {
  const result = streamText({
    model: getModel('deepseek-v4-pro'),
    system: RUNE_SYSTEM_PROMPT,
    messages,
    tools: {
      semantic_search: tool<any, any>({
        description: 'Search the saved archive by meaning. Returns the most relevant saved items.',
        inputSchema: z.object({
          query: z.string(),
          limit: z.number().optional(),
        }),
        execute: async ({ query, limit }) => {
          const results = await semanticSearch(query, limit ?? 5);
          return results.map((r) => ({
            id: r.id,
            title: r.title,
            url: r.url,
            platform: r.platform,
            metaSummary: r.metaSummary,
          }));
        },
      }),
      web_search: tool<any, any>({
        description: 'Search the web for current information.',
        inputSchema: z.object({
          query: z.string(),
        }),
        execute: async ({ query }) => webSearch(query),
      }),
      web_fetch: tool<any, any>({
        description: 'Fetch full text content from a URL.',
        inputSchema: z.object({
          url: z.string().url(),
        }),
        execute: async ({ url }) => webFetch(url),
      }),
      get_item: tool<any, any>({
        description: 'Retrieve a single saved item by ID.',
        inputSchema: z.object({
          id: z.string(),
        }),
        execute: async ({ id }) => getItem(id),
      }),
      list_items: tool<any, any>({
        description: 'Query saved items with filters.',
        inputSchema: z.object({
          tag: z.string().optional(),
          platform: z.string().optional(),
          status: z.string().optional(),
          pinned: z.boolean().optional(),
        }),
        execute: async (filters) => listItems(filters),
      }),
      save_item: tool<any, any>({
        description: 'Save a new item to the archive. Delegates to the Librarian for processing.',
        inputSchema: z.object({
          url: z.string().url(),
          context: z.string().optional(),
        }),
        execute: async ({ url, context }) => saveItem(url, context),
      }),
    },
  });

  return result;
}
