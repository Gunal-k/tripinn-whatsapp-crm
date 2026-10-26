import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  allowedDevOrigins: [
    '192.168.1.6',
    '192.168.1.6:3000',
    'localhost:3000',
    '127.0.0.1:3000',
    '192.168.*',
    '10.*',
    '172.*',
    '*.local',
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
