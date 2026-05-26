import { input } from '@inquirer/prompts';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ENV_PATH = resolve('.env');

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_PATH)) return {};
  const content = readFileSync(ENV_PATH, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^"(.*)"$/, '$1').replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return env;
}

function writeEnv(env: Record<string, string>) {
  const lines = Object.entries(env).map(([k, v]) => {
    const escaped = v.replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `${k}="${escaped}"`;
  });
  writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

function mask(value: string): string {
  if (!value) return '(not set)';
  if (value.length <= 8) return '********';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

export async function setupApi() {
  console.log('API Key Configuration\n');
  const env = readEnv();

  const keys = [
    { key: 'VERCEL_AI_GATEWAY_KEY', label: 'Vercel AI Gateway API key' },
    { key: 'DEEPSEEK_API_KEY', label: 'DeepSeek API key' },
    { key: 'EXA_API_KEY', label: 'Exa API key' },
    { key: 'VOYAGE_API_KEY', label: 'Voyage AI API key' },
    { key: 'DEEPGRAM_API_KEY', label: 'Deepgram API key' },
    { key: 'SUPADATA_API_KEY', label: 'SupaData API key' },
  ];

  for (const { key, label } of keys) {
    const current = env[key] || '';
    const val = await input({ message: `${label} (${mask(current)})`, default: current });
    if (val !== current) env[key] = val;
  }

  writeEnv(env);
  console.log('API keys updated.');
}
