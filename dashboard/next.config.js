/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  // Produces a minimal self-contained build (~150MB vs ~1GB)
  output: 'standalone',

  // Strict mode for better React practices
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable experimental features
  experimental: {
    // Note: instrumentationHook is now available by default in Next.js 16
    // Disabled until all routes are defined
    // typedRoutes: true,
  },

  // Environment variables available on client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Note: /api/health is handled by local API route
  // Other API routes are proxied via ALB listener rules, not rewrites

  // Headers for security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.amazonaws.com",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
