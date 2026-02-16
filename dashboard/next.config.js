/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployment
  // Produces a minimal self-contained build (~150MB vs ~1GB)
  output: 'standalone',

  // Strict mode for better React practices
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable experimental features for App Router
  experimental: {
    // Instrument for OpenTelemetry tracing (optional)
    instrumentationHook: true,
  },

  // Environment variables available on client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Image optimization configuration
  images: {
    // Allow images from specific domains
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
    // Optimize for container deployment
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Webpack configuration
  webpack: (config, { isServer }) => {
    // Handle SVGs as React components
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

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
        ],
      },
    ];
  },
};

module.exports = nextConfig;
