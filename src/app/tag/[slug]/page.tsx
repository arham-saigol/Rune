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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setItems([]);
    fetch(`/api/items?tag=${encodeURIComponent(slug)}&sort=created_desc`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => setItems(data.items))
      .catch((err) => {
        console.error('Failed to load tag items:', err);
        setItems([]);
      })
      .finally(() => setIsLoading(false));
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
    <main className="max-w-6xl mx-auto px-5 py-8">
      <header className="flex items-center justify-between mb-8">
        <h1 className="logotype">Rune</h1>
        <Link href="/settings" className="sketch-link text-sm">
          settings
        </Link>
      </header>
      <div className="mb-5">
        <SearchBar />
      </div>
      <div className="mb-4">
        <TagNav tags={tags} />
      </div>
      <div className="mb-5 flex items-baseline gap-4">
        <h2 className="section-head capitalize">{slug.replace(/-/g, ' ')}</h2>
        <Filters
          unreadOnly={unreadOnly}
          pinnedOnly={pinnedOnly}
          onToggleUnread={() => setUnreadOnly((v) => !v)}
          onTogglePinned={() => setPinnedOnly((v) => !v)}
        />
      </div>
      {isLoading ? (
        <div className="empty-state">loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">nothing tagged here yet ~</div>
      ) : (
        <CardGrid items={filtered} />
      )}
    </main>
  );
}
