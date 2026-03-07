import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for Enkai Qualify Dashboard
 *
 * Authentication is handled by AWS ALB with Cognito integration.
 * The ALB authenticates users before requests reach this application
 * and passes user info via x-amzn-oidc-* headers.
 *
 * This middleware is a simple passthrough - ALB handles auth.
 */
export default function middleware(_req: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
