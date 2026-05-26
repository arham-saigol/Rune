'use client';

import Card from './card';

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface Item {
  id: string;
  title: string;
  platform: string;
  illustration: string | null;
  status: string;
  pinned: number;
  tags?: Tag[];
}

export default function CardGrid({ items }: { items: Item[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {items.map((item, i) => (
        <div
          key={item.id}
          style={{ transform: `rotate(${(i % 5 - 2) * 0.3}deg)` }}
        >
          <Card item={item} />
        </div>
      ))}
    </div>
  );
}
