import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const envPath = process.env.DATA_DIR ? resolve(process.env.DATA_DIR, '../.env') : resolve('.env');
if (existsSync(envPath)) {
  config({ path: envPath });
}

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}
