'use client';

export default function ChatMessage({
  role,
  content,
}: {
  role: 'user' | 'assistant';
  content: string;
}) {
  return (
    <div className={`text-sm ${role === 'user' ? 'text-right' : 'text-left'}`}>
      <div
        className={`inline-block rounded-lg px-3 py-2 max-w-full whitespace-pre-wrap ${
          role === 'user'
            ? 'bg-[#2c1810] text-[#f5e6d3]'
            : 'bg-[#fff8ee] text-[#2c1810] border border-[#e8d5c0]'
        }`}
      >
        {content}
      </div>
    </div>
  );
}
