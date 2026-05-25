import { NextResponse } from 'next/server';
import { scoreFeed } from '@/feed/score';

export async function GET() {
  const feed = scoreFeed();
  return NextResponse.json({ items: feed });
}
