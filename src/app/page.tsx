'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

interface FeedItem {
  id: string;
  title: string;
  platform: string;
  illustration: string | null;
  status: string;
  pinned: number;
  createdAt: number;
  tags: Tag[];
  score: number;
}

export default function HomePage() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [searchResults, setSearchResults] = useState<FeedItem[] | null>(null);
  const feedRef = useRef<FeedItem[]>([]);
  const PER_PAGE = 20;

  useEffect(() => {
    fetch('/api/feed')
      .then((r) => r.json())
      .then((data) => {
        feedRef.current = data.items;
        setFeed(data.items);
        setLoading(false);
      });
    fetch('/api/tags')
      .then((r) => r.json())
      .then((data) => setTags(data.tags));
  }, []);

  const handleSearch = useCallback((q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    fetch(`/api/items?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data) => {
        const mapped = data.items.map((item: any) => ({ ...item, tags: [], score: 0 }));
        setSearchResults(mapped);
      });
  }, []);

  const displayed = searchResults ?? feed;
  const filtered = displayed.filter((item) => {
    if (unreadOnly && item.status !== 'unread') return false;
    if (pinnedOnly && !item.pinned) return false;
    return true;
  });

  const visible = filtered.slice(0, page * PER_PAGE);

  const loadMore = () => setPage((p) => p + 1);

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Rune</h1>
        <Link href="/settings" className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
          Settings
        </Link>
      </header>

      <div className="mb-4">
        <SearchBar onSearch={handleSearch} />
      </div>

      <div className="mb-4">
        <TagNav tags={tags} />
      </div>

      <div className="mb-4">
        <Filters
          unreadOnly={unreadOnly}
          pinnedOnly={pinnedOnly}
          onToggleUnread={() => setUnreadOnly((v) => !v)}
          onTogglePinned={() => setPinnedOnly((v) => !v)}
        />
      </div>

      {loading ? (
        <div className="text-sm text-[#8a6e5b]">Loading...</div>
      ) : (
        <>
          <CardGrid items={visible} />
          {visible.length < filtered.length && (
            <div className="mt-6 text-center">
              <button onClick={loadMore} className="btn">
                Load more
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
