import { streamText, tool } from 'ai';
import { z } from 'zod';
import { webSearch } from './tools/web-search';
import { webFetch } from './tools/web-fetch';
import { getModel } from './model-helper';

const MODE_PROMPTS: Record<string, string> = {
  short: 'Summarize the following content in 1-3 concise paragraphs. Focus on the main argument, key findings, and practical takeaways.',
  five_points: 'Distill the following content into exactly 5 tight bullet points. Each bullet should capture one key idea. No preamble.',
  eli5: "Explain the following content as if you're talking to a curious beginner with no background in this topic. Use simple language, analogies, and short sentences. Avoid jargon.",
  devils_advocate: "Present two opposing perspectives on the following content. For each side, give a clear argument with supporting reasoning. Be fair and rigorous with both positions.",
};

const COMMON_SUFFIX = `Rely primarily on the provided source content. However, if the content references events, research, or claims that may be after your knowledge cutoff, you may use web_search to verify or find additional context. Do not invent facts.`;

export async function runSummaryAgent(content: string, mode: string) {
  const system = `${MODE_PROMPTS[mode] ?? MODE_PROMPTS.short}\n\n${COMMON_SUFFIX}`;

  return streamText({
    model: getModel('deepseek-v4-flash'),
    system,
    prompt: content,
    tools: {
      web_search: tool<any, any>({
        description: 'Search the web for current information.',
        inputSchema: z.object({ query: z.string() }),
        execute: async ({ query }) => webSearch(query),
      }),
      web_fetch: tool<any, any>({
        description: 'Fetch full text content from a URL.',
        inputSchema: z.object({ url: z.string().url() }),
        execute: async ({ url }) => webFetch(url),
      }),
    },
  });
}
