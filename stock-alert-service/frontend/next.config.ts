import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
});

const nextConfig: NextConfig = {
  output: 'standalone',
  // Serwist uses webpack; silence Turbopack warning in Next.js 16
  turbopack: {},
};

export default withSerwist(nextConfig);
