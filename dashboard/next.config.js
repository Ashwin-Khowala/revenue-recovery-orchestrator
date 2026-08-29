/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  },
  async rewrites() {
    const backendUrl = (process.env.ORCHESTRATOR_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
    return [
      {
        source: '/api/orchestrator/:path*',
        destination: `${backendUrl}/api/orchestrator/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
