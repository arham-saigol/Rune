'use client';

import { useState } from 'react';

export default function SearchBar({ onSearch }: { onSearch?: (q: string) => void }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full relative">
      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[var(--pencil)] text-sm select-none pointer-events-none">
        ~
      </span>
      <input
        type="text"
        placeholder="search your archive..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input w-full pl-4"
      />
    </form>
  );
}
