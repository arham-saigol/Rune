'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tag {
  id: number;
  name: string;
  slug: string;
}

export default function TagNav({ tags }: { tags: Tag[] }) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="flex gap-1 overflow-x-auto pb-2">
      <Link
        href="/"
        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
          isActive('/') ? 'bg-[#2c1810] text-[#f5e6d3]' : 'bg-[#e8d5c0] text-[#5a3e2b] hover:bg-[#d4c0a8]'
        }`}
      >
        For You
      </Link>
      <Link
        href="/all"
        className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
          isActive('/all') ? 'bg-[#2c1810] text-[#f5e6d3]' : 'bg-[#e8d5c0] text-[#5a3e2b] hover:bg-[#d4c0a8]'
        }`}
      >
        All
      </Link>
      {tags.map((tag) => (
        <Link
          key={tag.id}
          href={`/tag/${tag.slug}`}
          className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
            pathname === `/tag/${tag.slug}` ? 'bg-[#2c1810] text-[#f5e6d3]' : 'bg-[#e8d5c0] text-[#5a3e2b] hover:bg-[#d4c0a8]'
          }`}
        >
          {tag.name}
        </Link>
      ))}
    </nav>
  );
}
