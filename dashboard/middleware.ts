import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Don't proxy /api/health - let it be handled by the API route
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  // Proxy all other /api/* routes to backend
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const apiUrl = process.env.API_URL || 'http://localhost:8000';
    const url = new URL(request.nextUrl.pathname, apiUrl);
    url.search = request.nextUrl.search;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
