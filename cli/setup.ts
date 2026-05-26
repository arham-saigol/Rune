import { input, confirm } from '@inquirer/prompts';
import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
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

export async function fullSetup() {
  console.log('Rune Setup Wizard\n');

  const env = readEnv();

  // Step 1: Check dependencies
  console.log('Step 1: Checking dependencies...');
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' }).trim();
    console.log(`  Node.js: ${nodeVersion}`);
  } catch {
    console.log('  Node.js not found. Please install Node.js 20+');
  }

  // Step 2: API keys
  console.log('\nStep 2: API Keys (press Enter to keep existing)');
  env.VERCEL_AI_GATEWAY_KEY = await input({ message: 'Vercel AI Gateway API key', default: env.VERCEL_AI_GATEWAY_KEY || '' }) || env.VERCEL_AI_GATEWAY_KEY || '';
  env.DEEPSEEK_API_KEY = await input({ message: 'DeepSeek API key', default: env.DEEPSEEK_API_KEY || '' }) || env.DEEPSEEK_API_KEY || '';
  env.EXA_API_KEY = await input({ message: 'Exa API key', default: env.EXA_API_KEY || '' }) || env.EXA_API_KEY || '';
  env.VOYAGE_API_KEY = await input({ message: 'Voyage AI API key', default: env.VOYAGE_API_KEY || '' }) || env.VOYAGE_API_KEY || '';
  env.DEEPGRAM_API_KEY = await input({ message: 'Deepgram API key', default: env.DEEPGRAM_API_KEY || '' }) || env.DEEPGRAM_API_KEY || '';
  env.SUPADATA_API_KEY = await input({ message: 'SupaData API key', default: env.SUPADATA_API_KEY || '' }) || env.SUPADATA_API_KEY || '';

  // Step 3: Discord
  console.log('\nStep 3: Discord Configuration');
  env.DISCORD_BOT_TOKEN = await input({ message: 'Discord Bot Token', default: env.DISCORD_BOT_TOKEN || '' }) || env.DISCORD_BOT_TOKEN || '';
  env.DISCORD_PUBLIC_KEY = await input({ message: 'Discord Public Key', default: env.DISCORD_PUBLIC_KEY || '' }) || env.DISCORD_PUBLIC_KEY || '';
  env.DISCORD_APPLICATION_ID = await input({ message: 'Discord Application ID', default: env.DISCORD_APPLICATION_ID || '' }) || env.DISCORD_APPLICATION_ID || '';

  // Step 4: Cloudflare Tunnel
  console.log('\nStep 4: Cloudflare Tunnel');
  const setupTunnel = await confirm({ message: 'Configure Cloudflare Tunnel?', default: false });
  if (setupTunnel) {
    try {
      execSync('cloudflared tunnel login', { stdio: 'inherit' });
      execSync('cloudflared tunnel create rune', { stdio: 'inherit' });
    } catch {
      console.log('Tunnel setup skipped or failed.');
    }
  }

  // Step 5: Write config
  env.PORT = env.PORT || '3000';
  env.DATA_DIR = env.DATA_DIR || './data';
  env.NODE_ENV = 'production';
  writeEnv(env);

  // Ensure data directory
  if (!existsSync(env.DATA_DIR)) mkdirSync(env.DATA_DIR, { recursive: true });

  console.log('\nConfiguration saved to .env');

  // Step 6: systemd service
  console.log('\nStep 6: Installing systemd service...');
  try {
    const servicePath = resolve('systemd/rune.service');
    if (existsSync(servicePath)) {
      execSync(`sudo cp ${servicePath} /etc/systemd/system/rune.service`);
      execSync('sudo systemctl daemon-reload');
      execSync('sudo systemctl enable rune');
      console.log('Systemd service installed.');
    }
  } catch {
    console.log('Could not install systemd service (requires sudo).');
  }

  console.log('\nSetup complete! Run `npx rune start` to begin.');
}
