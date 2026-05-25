import next from 'next';
import { createServer } from 'http';
import { createBot } from './discord';
import { initDatabase } from '../db/client';

async function main() {
  // Initialize database
  initDatabase();

  // Seed default tags
  try {
    await import('../db/seed');
  } catch {
    // seed module may have side effects only
  }

  // Start Next.js
  const app = next({ dev: false });
  await app.prepare();
  const handle = app.getRequestHandler();

  const port = Number(process.env.PORT) || 3000;
  const server = createServer((req, res) => handle(req, res));
  server.listen(port, '127.0.0.1', () => {
    console.log(`Rune gateway listening on http://127.0.0.1:${port}`);
  });

  // Start Discord bot
  try {
    const bot = createBot();
    await (bot as any).adapters.discord.startGatewayListener();
    console.log('Discord gateway connected');
  } catch (err) {
    console.warn('Discord bot not started:', err);
  }
}

main().catch(console.error);
