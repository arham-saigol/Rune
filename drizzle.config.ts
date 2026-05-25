import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATA_DIR ? `${process.env.DATA_DIR}/rune.db` : './data/rune.db',
  },
});
