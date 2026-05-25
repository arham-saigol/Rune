import { useState, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useAgentChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);

  const send = useCallback(async (text: string, contextItem?: { title: string; content: string | null; metaSummary: string }) => {
    const userMsg = text.trim();
    if (!userMsg || streaming) return;

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
      assistantText += decoder.decode(value, { stream: true });
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: 'assistant', content: assistantText };
        return copy;
      });
    }

    setStreaming(false);
  }, [streaming]);

  return { messages, streaming, send };
}
