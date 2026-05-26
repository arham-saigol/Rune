import { z } from 'zod';
import { generateObject } from 'ai';
import { webFetch } from './tools/web-fetch';
import { getModel } from './model-helper';

const illustrationElementSchema = z.union([
  z.object({ type: z.literal('circle'), x: z.number(), y: z.number(), diameter: z.number(), fill: z.string().optional(), stroke: z.string().optional() }),
  z.object({ type: z.literal('rectangle'), x: z.number(), y: z.number(), width: z.number(), height: z.number(), fill: z.string().optional(), stroke: z.string().optional() }),
  z.object({ type: z.literal('line'), x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), stroke: z.string().optional() }),
  z.object({ type: z.literal('ellipse'), x: z.number(), y: z.number(), width: z.number(), height: z.number(), fill: z.string().optional(), stroke: z.string().optional() }),
  z.object({ type: z.literal('path'), d: z.string(), fill: z.string().optional(), stroke: z.string().optional() }),
  z.object({ type: z.literal('text'), x: z.number(), y: z.number(), content: z.string(), fontSize: z.number().optional(), fill: z.string().optional() }),
]);

const catalogSchema = z.object({
  title: z.string().max(80),
  metaSummary: z.string(),
  keywords: z.array(z.string()).length(5),
  tagSlugs: z.array(z.string()).min(1).max(3),
  illustration: z.object({
    background: z.string(),
    elements: z.array(illustrationElementSchema),
  }),
});

const LIBRARIAN_SYSTEM_PROMPT = `You are the Librarian, an internal agent responsible for cataloging saved content. When given a URL and its fetched content, you must:

1. Write a concise, descriptive title (max 80 chars).
2. Write a meta summary (2-3 sentences) optimized for semantic search. It should capture the core topic, key claims, and relevance.
3. Generate exactly 5 keywords as a JSON array of strings.
4. Assign 1-3 tags from the available tag list.
5. Create an illustration spec for a hand-drawn sketch that represents the content visually.

Canvas is 200x140 (card aspect ratio). Use simple geometric shapes to create an abstract, thematic sketch.

If the content was not successfully fetched by the automated pipeline, try fetching it yourself via external means in your reasoning, but still provide your best catalog based on the URL and any context given.

Do not search for related content. Your job is strictly to catalog what the user has shared.`;

export async function runLibrarian(
  url: string,
  content: string | null,
  userContext: string | undefined,
  availableTags: { name: string; slug: string }[]
) {
  const tagList = availableTags.map((t) => `${t.slug} (${t.name})`).join(', ');

  let fetchedContent = content;
  if (!fetchedContent) {
    fetchedContent = await webFetch(url);
  }

  const MAX_CONTENT = 30000; // keep under model context-window limits
  let safeContent: string;
  if (!fetchedContent) {
    safeContent = 'Could not fetch content automatically.';
  } else if (fetchedContent.length <= MAX_CONTENT) {
    safeContent = fetchedContent;
  } else {
    const trimmed = fetchedContent.slice(0, MAX_CONTENT);
    const lastStop = Math.max(
      trimmed.lastIndexOf('.'),
      trimmed.lastIndexOf('!'),
      trimmed.lastIndexOf('?'),
      trimmed.lastIndexOf('\n')
    );
    safeContent = lastStop > 0 ? trimmed.slice(0, lastStop + 1) + '...' : trimmed + '...';
  }
  const prompt = `URL: ${url}\nUser context: ${userContext ?? 'none'}\nAvailable tags: ${tagList}\n\nContent:\n${safeContent}`;

  const result = await generateObject({
    model: getModel('deepseek-v4-pro'),
    system: LIBRARIAN_SYSTEM_PROMPT,
    prompt,
    schema: catalogSchema,
  });

  return { ...result.object, fetchedContent };
}
