import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
    // Product imagery for the equipment marketplace (/equipos) is hotlinked
    // from supplier CDNs; next/image refuses external hosts unless listed here.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.made-in-china.com',
      },
    ],
  },
};

export default nextConfig;
