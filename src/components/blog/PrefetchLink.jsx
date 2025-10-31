'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export default function PrefetchLink({ href, children, className, ...rest }) {
  const router = useRouter();

  const doPrefetch = useCallback(() => {
    try {
      router.prefetch(href).catch(() => {});
    } catch (e) {}
  }, [href, router]);

  return (
    <Link
      href={href}
      className={className}
      onMouseEnter={doPrefetch}
      onFocus={doPrefetch}
      {...rest}
    >
      {children}
    </Link>
  );
}
