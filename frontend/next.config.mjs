/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for Netlify deployment
  output: 'standalone',

  // Allow cross-origin images if needed
  images: {
    unoptimized: true,
  },

  // Environment variables exposed to browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:5001',
  },
};

export default nextConfig;
