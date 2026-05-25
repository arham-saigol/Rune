import { useState, useEffect } from 'react';

export function useSummary(itemId: string, mode: string) {
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

  return { summary, loading };
}
