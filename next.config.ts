import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Extend serverless function timeout to 60s
  // Default is 10s on Hobby — not enough for AI calls under rate limit retry
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [{ key: 'x-max-duration', value: '60' }],
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'https://cic-backend-v2.vercel.app';
    return [
      { source: '/api/generate',      destination: `${backendUrl}/api/generate` },
      { source: '/api/auth/:path*',   destination: `${backendUrl}/api/auth/:path*` },
      { source: '/api/user/:path*',   destination: `${backendUrl}/api/user/:path*` },
    ];
  },
};

export default nextConfig;
