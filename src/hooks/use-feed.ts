import { useState, useEffect } from 'react';

interface FeedItem {
  id: string;
  title: string;
  platform: string;
  illustration: string | null;
  status: string;
  pinned: number;
  createdAt: number;
  tags: { id: number; name: string; slug: string }[];
  score: number;
}

export function useFeed() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/feed')
      .then((r) => r.json())
      .then((data) => {
        setFeed(data.items);
        setLoading(false);
      });
  }, []);

  return { feed, loading, refetch: () => window.location.reload() };
}
