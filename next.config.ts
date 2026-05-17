import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    // If the extension calls chattersinnercircle.vercel.app/api/generate
    // (wrong domain — no AI keys there), proxy it transparently to the backend.
    // This means both URLs work regardless of which one the extension has saved.
    const backendUrl = process.env.BACKEND_URL || 'https://cic-backend-v2.vercel.app';
    return [
      {
        source: '/api/generate',
        destination: `${backendUrl}/api/generate`,
      },
      {
        source: '/api/auth/:path*',
        destination: `${backendUrl}/api/auth/:path*`,
      },
      {
        source: '/api/user/:path*',
        destination: `${backendUrl}/api/user/:path*`,
      },
    ];
  },
};

export default nextConfig;
