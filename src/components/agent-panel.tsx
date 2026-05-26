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
  const [conversationId] = useState(() => crypto.randomUUID());
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
      body: JSON.stringify({ message: contextPrompt, contextItemId: contextItem?.id, conversationId }),
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
      <div className="absolute inset-0 bg-[var(--ink)]/15 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md paper-bg h-full flex flex-col border-l-[1.5px] border-[var(--rule)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--rule)]">
          <h2 className="font-[var(--font-hand)] text-xl" style={{ fontFamily: 'var(--font-hand)' }}>
            ask rune
          </h2>
          <button onClick={onClose} className="sketch-link text-sm">
            close
          </button>
        </div>

        {contextItem && (
          <div className="px-5 py-2 border-b border-[var(--rule)] text-sm truncate text-[var(--pencil)]">
            re: <span className="italic">{contextItem.title}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="empty-state text-base pt-12">
              ask me anything about your saved items ~
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap ${
                  m.role === 'user' ? 'bubble-user' : 'bubble-assistant'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-5 py-4 border-t border-[var(--rule)]">
          <div className="flex gap-3 items-end">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="type here..."
              className="input flex-1"
              disabled={streaming}
            />
            <button onClick={send} className="btn" disabled={streaming}>
              send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
