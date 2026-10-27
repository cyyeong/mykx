import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The Studio transform reads Kix's base image from disk; Vercel functions don't ship public/ by default.
  outputFileTracingIncludes: { "/api/studio/transform": ["./public/art/kix/kix-base.webp"] },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // Keep CSS modules out: `as: "*.css"` would strip their module semantics.
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
