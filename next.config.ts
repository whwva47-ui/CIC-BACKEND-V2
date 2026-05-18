import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // maxDuration is set per-route via export const maxDuration = 60 in route.ts
  // No rewrites needed — the extension calls cic-backend-v2.vercel.app directly
};

export default nextConfig;
