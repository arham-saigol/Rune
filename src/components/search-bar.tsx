'use client';

import { useState } from 'react';

export default function SearchBar({ onSearch }: { onSearch?: (q: string) => void }) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(query);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <input
        type="text"
        placeholder="Search your archive..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input w-full"
      />
    </form>
  );
}
