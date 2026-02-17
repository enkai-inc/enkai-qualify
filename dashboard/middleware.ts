import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/health(.*)',
  '/api/webhooks/(.*)',
]);

// Check if Clerk is configured
const isClerkConfigured = () => {
  return !!(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY
  );
};

// Fallback middleware when Clerk is not configured
function fallbackMiddleware(req: NextRequest) {
  // Allow health checks and webhooks to pass through
  if (
    req.nextUrl.pathname.startsWith('/api/health') ||
    req.nextUrl.pathname.startsWith('/api/webhooks/')
  ) {
    return NextResponse.next();
  }
  // Redirect all other requests to a configuration error page or allow through
  // For now, allow through but protected routes will fail at the API level
  return NextResponse.next();
}

// Use Clerk middleware only if configured
export default isClerkConfigured()
  ? clerkMiddleware(async (auth, req) => {
      if (!isPublicRoute(req)) {
        await auth.protect();
      }
    })
  : fallbackMiddleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
