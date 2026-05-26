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
      <main className="max-w-3xl mx-auto px-5 py-8">
        <div className="empty-state text-base">loading...</div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="sketch-link text-sm">
          &larr; back
        </Link>
        <div className="flex gap-4">
          <button onClick={togglePin} className="sketch-link text-sm">
            {item.pinned ? 'unpin' : 'pin'}
          </button>
          <button onClick={() => setPanelOpen(true)} className="sketch-link text-sm">
            ask rune
          </button>
        </div>
      </div>

      <article className="settings-section mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="platform-badge">
            {PLATFORM_LABELS[item.platform] || item.platform}
          </span>
          <span className="text-[0.65rem] text-[var(--pencil)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {item.pinned ? (
            <span className="text-xs text-[var(--washi)]" style={{ fontFamily: 'var(--font-mono)' }}>
              pinned
            </span>
          ) : null}
        </div>

        <h1 className="text-xl font-bold mb-2 leading-tight" style={{ fontFamily: 'var(--font-editorial)' }}>
          {item.title}
        </h1>

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="sketch-link text-sm block truncate mb-4"
        >
          {item.url}
        </a>

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {item.tags.map((tag) => (
              <span key={tag.id} className="tag-pill">
                {tag.name}
              </span>
            ))}
          </div>
        )}

        <hr className="sketch-rule" />

        <div className="mb-5">
          <div className="flex gap-2 flex-wrap mb-3">
            {SUMMARY_MODES.map((m) => (
              <button
                key={m.slug}
                onClick={() => setMode(m.slug)}
                className={`nav-pill ${mode === m.slug ? 'nav-pill--active' : 'nav-pill--inactive'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="bg-[var(--paper-warm)] border border-[var(--rule)] rounded-[3px] p-5 min-h-[120px]">
            {loading && !summary ? (
              <div className="space-y-3">
                <div className="skel h-4 w-3/4" />
                <div className="skel h-4 w-1/2" />
                <div className="skel h-4 w-5/6" />
              </div>
            ) : (
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{summary || item.metaSummary}</div>
            )}
          </div>
        </div>

        {item.content && (
          <>
            <hr className="sketch-rule" />
            <div>
              <h3 className="section-head mb-3">Full Content</h3>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{item.content}</div>
            </div>
          </>
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
