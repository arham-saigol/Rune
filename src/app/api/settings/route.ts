import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db/client';
import { settings } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const rows = db.select().from(settings).all();
  const result: Record<string, any> = {};
  for (const row of rows) {
    try {
      result[row.key] = JSON.parse(row.value);
    } catch {
      result[row.key] = row.value;
    }
  }
  return NextResponse.json(result);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const db = getDb();
  for (const [key, value] of Object.entries(body)) {
    const existing = db.select().from(settings).where(eq(settings.key, key)).get();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    if (existing) {
      db.update(settings).set({ value: serialized }).where(eq(settings.key, key)).run();
    } else {
      db.insert(settings).values({ key, value: serialized }).run();
    }
  }
  return NextResponse.json({ success: true });
}
