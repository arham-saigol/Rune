'use client';

import Link from 'next/link';
import Illustration from './illustration';
import { PLATFORM_LABELS } from '@/lib/constants';

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

export default function Card({ item }: { item: Item }) {
  let illustration: any = null;
  try {
    if (item.illustration) illustration = JSON.parse(item.illustration);
  } catch {
    illustration = null;
  }

  const isUnread = item.status === 'unread';

  return (
    <Link href={`/item/${item.id}`} className="block">
      <div
        className={`card overflow-hidden ${isUnread ? 'opacity-100' : 'opacity-60'}`}
      >
        <div className="aspect-[10/7] bg-[#eee0d0]">
          <Illustration spec={illustration} />
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[0.7rem] uppercase tracking-wide text-[#8a6e5b]">
              {PLATFORM_LABELS[item.platform] || item.platform}
            </span>
            {item.pinned ? (
              <span className="text-[0.7rem] text-amber-600">★</span>
            ) : null}
          </div>
          <h3 className="text-sm font-semibold leading-snug line-clamp-2 mb-2">
            {item.title}
          </h3>
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {item.tags.map((tag) => (
                <span key={tag.id} className="tag-pill">
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
