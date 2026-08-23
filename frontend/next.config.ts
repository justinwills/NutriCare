import type { NextConfig } from "next";

const targetBackend = (
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:3002"
)
  .trim()
  .replace(/\/$/, "");

const isExternalBackend = /^https?:\/\//i.test(targetBackend);

const nextConfig: NextConfig = {
  images: {
    // Vercel's multi-service deployment does not expose Next's optimizer
    // route; serve the committed public assets directly instead.
    unoptimized: true,
    // Next 16 only emits qualities listed here. Keep the cinematic landing
    // photography at a high quality instead of silently falling back to 75.
    qualities: [75, 95, 100],
  },
  async rewrites() {
    if (!isExternalBackend && process.env.NODE_ENV === "production") {
      return [];
    }
    const backendHost = isExternalBackend
      ? targetBackend
      : "http://localhost:3002";
    return [
      {
        source: "/api/:path*",
        destination: `${backendHost}/api/:path*`,
      },
      { source: "/health", destination: `${backendHost}/health` },
    ];
  },
};

export default nextConfig;
