'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { PLATFORM_LABELS, SUMMARY_MODES } from '@/lib/constants';
import AgentPanel from '@/components/agent-panel';

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface ItemDetail {
  id: string;
  url: string;
  platform: string;
  title: string;
  content: string | null;
  metaSummary: string;
  status: string;
  pinned: number;
  createdAt: number;
  tags: Tag[];
}

export default function ItemPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [mode, setMode] = useState('short');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch(`/api/items/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setItem(data);
        if (data.status === 'unread') {
          fetch(`/api/items/${id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ status: 'read' }),
          });
        }
      });
  }, [id]);

  useEffect(() => {
    if (!item) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setSummary('');

    fetch(`/api/items/${id}/summary?mode=${mode}`, { signal: controller.signal })
      .then((res) => {
        const reader = res.body?.getReader();
        if (!reader) {
          setLoading(false);
          return;
        }
        const decoder = new TextDecoder();
        function read(r: ReadableStreamDefaultReader<Uint8Array>) {
          r.read().then(({ done, value }) => {
            if (done) {
              setLoading(false);
              return;
            }
            setSummary((prev) => prev + decoder.decode(value, { stream: true }));
            read(r);
          });
        }
        read(reader);
      })
      .catch(() => setLoading(false));
  }, [id, mode, item?.id]);

  const togglePin = () => {
    if (!item) return;
    fetch(`/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pinned: !item.pinned }),
    }).then(() => setItem((prev) => prev ? { ...prev, pinned: prev.pinned ? 0 : 1 } : prev));
  };

  if (!item) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="text-sm text-[#8a6e5b]">Loading...</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
          ← Back
        </Link>
        <div className="flex gap-2">
          <button onClick={togglePin} className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
            {item.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button onClick={() => setPanelOpen(true)} className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
            Ask Rune
          </button>
        </div>
      </div>

      <article className="card p-6 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[0.7rem] uppercase tracking-wide text-[#8a6e5b]">
            {PLATFORM_LABELS[item.platform] || item.platform}
          </span>
          <span className="text-[0.7rem] text-[#8a6e5b]">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        </div>
        <h1 className="text-xl font-bold mb-2">{item.title}</h1>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[#5a3e2b] hover:text-[#2c1810] underline mb-4 block truncate"
        >
          {item.url}
        </a>
        <div className="flex flex-wrap gap-1 mb-4">
          {item.tags.map((tag) => (
            <span key={tag.id} className="tag-pill">
              {tag.name}
            </span>
          ))}
        </div>

        <div className="mb-4">
          <div className="flex gap-2 flex-wrap mb-2">
            {SUMMARY_MODES.map((m) => (
              <button
                key={m.slug}
                onClick={() => setMode(m.slug)}
                className={`px-3 py-1 rounded-full text-sm transition ${
                  mode === m.slug ? 'bg-[#2c1810] text-[#f5e6d3]' : 'bg-[#e8d5c0] text-[#5a3e2b] hover:bg-[#d4c0a8]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="bg-[#fff8ee] border border-[#e8d5c0] rounded-lg p-4 min-h-[120px]">
            {loading && !summary ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-[#e8d5c0] rounded w-3/4" />
                <div className="h-4 bg-[#e8d5c0] rounded w-1/2" />
                <div className="h-4 bg-[#e8d5c0] rounded w-5/6" />
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{summary || item.metaSummary}</div>
            )}
          </div>
        </div>

        {item.content && (
          <div className="prose prose-sm max-w-none">
            <h3 className="text-base font-semibold mb-2">Full Content</h3>
            <div className="text-sm leading-relaxed whitespace-pre-wrap">{item.content}</div>
          </div>
        )}
      </article>

      <AgentPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        contextItem={item}
      />
    </main>
  );
}
