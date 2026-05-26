'use client';

import { useState, useEffect } from 'react';
import { SUMMARY_MODES } from '@/lib/constants';

export default function SummaryViewer({ itemId, content }: { itemId: string; content: string }) {
  const [mode, setMode] = useState('short');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSummary('');

    const controller = new AbortController();
    fetch(`/api/items/${itemId}/summary?mode=${mode}`, { signal: controller.signal })
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

    return () => controller.abort();
  }, [itemId, mode]);

  return (
    <div>
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
      <div className="bg-[var(--card-bg)] border border-[var(--rule)] rounded-[3px] p-5 min-h-[120px]">
        {loading && !summary ? (
          <div className="space-y-3">
            <div className="skel h-4 w-3/4" />
            <div className="skel h-4 w-1/2" />
            <div className="skel h-4 w-5/6" />
          </div>
        ) : (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{summary || content}</div>
        )}
      </div>
    </div>
  );
}
