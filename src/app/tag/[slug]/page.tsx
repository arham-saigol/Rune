'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CardGrid from '@/components/card-grid';
import SearchBar from '@/components/search-bar';
import TagNav from '@/components/tag-nav';
import Filters from '@/components/filters';
import Link from 'next/link';

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface Item {
  id: string;
  title: string;
  platform: string;
  illustration: string | null;
  status: string;
  pinned: number;
  createdAt: number;
  tags?: Tag[];
}

export default function TagPage() {
  const { slug } = useParams<{ slug: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);

  useEffect(() => {
    fetch(`/api/items?tag=${encodeURIComponent(slug)}&sort=created_desc`)
      .then((r) => r.json())
      .then((data) => setItems(data.items));
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data) => setTags(data.tags));
  }, [slug]);

  const filtered = items.filter((item) => {
    if (unreadOnly && item.status !== 'unread') return false;
    if (pinnedOnly && !item.pinned) return false;
    return true;
  });

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Rune</h1>
        <Link href="/settings" className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
          Settings
        </Link>
      </header>
      <div className="mb-4">
        <SearchBar />
      </div>
      <div className="mb-4">
        <TagNav tags={tags} />
      </div>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold capitalize">{slug.replace(/-/g, ' ')}</h2>
        <Filters
          unreadOnly={unreadOnly}
          pinnedOnly={pinnedOnly}
          onToggleUnread={() => setUnreadOnly((v) => !v)}
          onTogglePinned={() => setPinnedOnly((v) => !v)}
        />
      </div>
      <CardGrid items={filtered} />
    </main>
  );
}
