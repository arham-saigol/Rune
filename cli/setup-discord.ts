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

export async function setupDiscord() {
  console.log('Discord Configuration\n');
  const env = readEnv();

  env.DISCORD_BOT_TOKEN = await input({ message: 'Discord Bot Token', default: env.DISCORD_BOT_TOKEN || '' }) || env.DISCORD_BOT_TOKEN || '';
  env.DISCORD_PUBLIC_KEY = await input({ message: 'Discord Public Key', default: env.DISCORD_PUBLIC_KEY || '' }) || env.DISCORD_PUBLIC_KEY || '';
  env.DISCORD_APPLICATION_ID = await input({ message: 'Discord Application ID', default: env.DISCORD_APPLICATION_ID || '' }) || env.DISCORD_APPLICATION_ID || '';

  writeEnv(env);
  console.log('Discord settings updated.');
}
