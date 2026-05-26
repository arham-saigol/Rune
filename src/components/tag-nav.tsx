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
    <nav className="flex gap-2 overflow-x-auto pb-2">
      <Link
        href="/"
        aria-current={isActive('/') ? 'page' : undefined}
        className={`nav-pill ${isActive('/') ? 'nav-pill--active' : 'nav-pill--inactive'}`}
      >
        For You
      </Link>
      <Link
        href="/all"
        aria-current={isActive('/all') ? 'page' : undefined}
        className={`nav-pill ${isActive('/all') ? 'nav-pill--active' : 'nav-pill--inactive'}`}
      >
        All
      </Link>
      {tags.map((tag) => (
        <Link
          key={tag.id}
          href={`/tag/${tag.slug}`}
          aria-current={pathname === `/tag/${tag.slug}` ? 'page' : undefined}
          className={`nav-pill ${pathname === `/tag/${tag.slug}` ? 'nav-pill--active' : 'nav-pill--inactive'}`}
        >
          {tag.name}
        </Link>
      ))}
    </nav>
  );
}
