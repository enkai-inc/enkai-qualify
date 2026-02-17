import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Check if Clerk is configured at startup
const CLERK_CONFIGURED =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

// Routes that don't require authentication (used when Clerk is enabled)
const PUBLIC_ROUTES = ['/', '/sign-in', '/sign-up', '/api/health', '/api/webhooks/'];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  );
}

// Simple passthrough middleware when Clerk is not configured
function unconfiguredMiddleware(req: NextRequest) {
  // Allow all requests through - authentication will fail at the API level
  // but health checks will work
  return NextResponse.next();
}

// Dynamically load and use Clerk middleware
async function configuredMiddleware(req: NextRequest) {
  // Skip public routes without loading Clerk
  if (isPublicRoute(req.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Dynamic import Clerk only when needed
  const { clerkMiddleware, createRouteMatcher } = await import(
    '@clerk/nextjs/server'
  );

  const isPublic = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/health(.*)',
    '/api/webhooks/(.*)',
  ]);

  // Create and invoke Clerk middleware
  const middleware = clerkMiddleware(async (auth, request) => {
    if (!isPublic(request)) {
      await auth.protect();
    }
  });

  return middleware(req, {} as never);
}

export default function middleware(req: NextRequest) {
  if (!CLERK_CONFIGURED) {
    return unconfiguredMiddleware(req);
  }
  return configuredMiddleware(req);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
