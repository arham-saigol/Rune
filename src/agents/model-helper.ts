import { createDeepSeek } from '@ai-sdk/deepseek';
import { getDb } from '@/db/client';
import { settings } from '@/db/schema';

const directDeepSeek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY || '',
});

export function getSettings() {
  const db = getDb();
  const rows = db.select().from(settings).all();
  const map: Record<string, any> = {};
  for (const row of rows) {
    try {
      map[row.key] = JSON.parse(row.value);
    } catch {
      map[row.key] = row.value;
    }
  }
  return {
    aiProviderPriority: (map.ai_provider_priority as string) || 'gateway_first',
    defaultSummaryMode: (map.default_summary_mode as string) || 'short',
    themePreferences: map.theme_preferences || '{}',
  };
}

export function getModel(modelId: string, prefer?: 'gateway' | 'direct') {
  const cfg = getSettings();
  const priority = prefer || cfg.aiProviderPriority;

  if (priority === 'gateway_first') {
    try {
      const gatewayKey = process.env.VERCEL_AI_GATEWAY_KEY;
      if (!gatewayKey) throw new Error('Missing VERCEL_AI_GATEWAY_KEY');
      const baseURL = process.env.GATEWAY_BASE_URL || 'https://gateway.ai.vercel.app/v1';
      const gatewayProvider = createDeepSeek({
        apiKey: gatewayKey,
        baseURL,
      });
      return gatewayProvider(modelId);
    } catch {
      return directDeepSeek(modelId);
    }
  }

  try {
    return directDeepSeek(modelId);
  } catch {
    const gatewayKey = process.env.VERCEL_AI_GATEWAY_KEY;
    if (!gatewayKey) throw new Error('No AI provider configured');
    const baseURL = process.env.GATEWAY_BASE_URL || 'https://gateway.ai.vercel.app/v1';
    const gatewayProvider = createDeepSeek({
      apiKey: gatewayKey,
      baseURL,
    });
    return gatewayProvider(modelId);
  }
}
