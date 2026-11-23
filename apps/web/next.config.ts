import type { NextConfig } from 'next';

const apiUrl = process.env['API_URL'] ?? 'http://localhost:3001';

const config: NextConfig = {
  // Browser calls go to /api/* on this origin, so the session cookie stays first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${apiUrl}/:path*` }];
  },
  transpilePackages: ['@dozbyte/shared'],
};

export default config;
