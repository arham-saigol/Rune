'use client';

import { useState, useRef, useEffect } from 'react';

interface Item {
  id: string;
  title: string;
  content: string | null;
  metaSummary: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AgentPanel({
  open,
  onClose,
  contextItem,
}: {
  open: boolean;
  onClose: () => void;
  contextItem?: Item | null;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);

    const contextPrompt = contextItem
      ? `Context item: ${contextItem.title}\n${contextItem.content || contextItem.metaSummary}\n\nUser question: ${userMsg}`
      : userMsg;

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: contextPrompt }),
    });

    const reader = res.body?.getReader();
    if (!reader) {
      setStreaming(false);
      return;
    }

    const decoder = new TextDecoder();
    let assistantText = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      assistantText += chunk;
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: assistantText };
        return copy;
      });
    }

    setStreaming(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#f5e6d3] h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#e8d5c0]">
          <h2 className="font-semibold">Rune Agent</h2>
          <button onClick={onClose} className="text-sm text-[#5a3e2b] hover:text-[#2c1810]">
            Close
          </button>
        </div>

        {contextItem && (
          <div className="px-4 py-2 bg-[#e8d5c0]/30 text-sm truncate">
            Context: <span className="font-medium">{contextItem.title}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-sm ${
                m.role === 'user' ? 'text-right' : 'text-left'
              }`}
            >
              <div
                className={`inline-block rounded-lg px-3 py-2 max-w-full whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-[#2c1810] text-[#f5e6d3]'
                    : 'bg-[#fff8ee] text-[#2c1810] border border-[#e8d5c0]'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t border-[#e8d5c0]">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Ask Rune..."
              className="input flex-1"
              disabled={streaming}
            />
            <button onClick={send} className="btn" disabled={streaming}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
