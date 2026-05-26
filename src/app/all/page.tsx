'use client';

import { useEffect, useState } from 'react';
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

export default function AllPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<Item[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadItems = () => {
    setIsLoading(true);
    setError(null);
    fetch('/api/items?sort=created_desc')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setItems(data.items);
        setError(null);
      })
      .catch((err) => {
        console.error('Failed to load items:', err);
        setError(err);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadItems();
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data) => setTags(data.tags));
  }, []);

  const handleSearch = (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    fetch(`/api/items?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => setSearchResults(data.items))
      .catch((err) => console.error('Search failed:', err));
  };

  const displayed = searchResults ?? items;
  const filtered = displayed.filter((item) => {
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
        <SearchBar onSearch={handleSearch} />
      </div>
      <div className="mb-4">
        <TagNav tags={tags} />
      </div>
      <div className="mb-5">
        <Filters
          unreadOnly={unreadOnly}
          pinnedOnly={pinnedOnly}
          onToggleUnread={() => setUnreadOnly((v) => !v)}
          onTogglePinned={() => setPinnedOnly((v) => !v)}
        />
      </div>
      {error ? (
        <div className="empty-state">
          <p className="mb-3">failed to load items</p>
          <button onClick={loadItems} className="btn">retry</button>
        </div>
      ) : isLoading ? (
        <div className="empty-state">loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">nothing saved yet ~ your archive is waiting</div>
      ) : (
        <CardGrid items={filtered} />
      )}
    </main>
  );
}
