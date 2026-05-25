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
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{summary || content}</div>
        )}
      </div>
    </div>
  );
}
