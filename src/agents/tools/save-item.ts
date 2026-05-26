import { captureItem } from '@/pipeline/capture';

export async function saveItem(url: string, context?: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('URL must use http or https');
    }
    if (parsed.hostname === 'localhost' || parsed.hostname.endsWith('.internal') || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
      throw new Error('URL host is not allowed');
    }
  } catch {
    throw new Error('Invalid URL');
  }
  return captureItem(url, context);
}
