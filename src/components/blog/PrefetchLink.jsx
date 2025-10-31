'use client';
import Link from 'next/link';

// Simple forwarding Link. Rely on Next's built-in prefetch behavior instead of
// calling router.prefetch which doesn't warm server-side external fetches.
export default function PrefetchLink({ href, children, className, ...rest }) {
  return (
    <Link href={href} className={className} {...rest}>
      {children}
    </Link>
  );
}
