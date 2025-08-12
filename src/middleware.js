// middleware.js  (or src/middleware.js)
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE = 'ms_session';
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me');

export default async function middleware(request) {
  // Protect ONLY the homepage
  if (request.nextUrl.pathname !== '/') {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE)?.value;

  if (token) {
    try {
      await jwtVerify(token, secret); // valid -> allow
      return NextResponse.next();
    } catch {
      // invalid/expired -> fall through
    }
  }

  // Not authenticated -> go to login page
  const loginUrl = new URL('/admin-login', request.url);
  return NextResponse.redirect(loginUrl);
}

// Only run on /
export const config = {
  matcher: ['/'],
};
