import { captureItem } from '@/pipeline/capture';
import { isPublicHost } from '@/lib/host-validation';

export async function saveItem(url: string, context?: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (err: any) {
    throw new Error(`Invalid URL: ${err.message}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must use http or https');
  }
  const publicHost = await isPublicHost(parsed.hostname);
  if (!publicHost) {
    throw new Error('URL host is not allowed');
  }
  return captureItem(url, context);
}
