'use client';

export default function ChatMessage({
  role,
  content,
}: {
  role: 'user' | 'assistant';
  content: string;
}) {
  return (
    <div className={`flex ${role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap ${
          role === 'user' ? 'bubble-user' : 'bubble-assistant'
        }`}
      >
        {content}
      </div>
    </div>
  );
}
