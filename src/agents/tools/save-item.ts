import { captureItem } from '@/pipeline/capture';

export async function saveItem(url: string, context?: string) {
  return captureItem(url, context);
}
