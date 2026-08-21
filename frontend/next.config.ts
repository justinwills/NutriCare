import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Next 16 only emits qualities listed here. Keep the cinematic landing
    // photography at a high quality instead of silently falling back to 75.
    qualities: [75, 95, 100],
  },
};

export default nextConfig;
