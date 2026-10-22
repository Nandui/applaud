import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Uploaded pictures live on Vercel Blob; GIPHY GIFs are shown as-is.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }],
    // Blob URLs carry a random suffix and never change, so resized copies can
    // be kept for a month instead of the default four hours.
    minimumCacheTTL: 60 * 60 * 24 * 31,
  },
};

export default nextConfig;
