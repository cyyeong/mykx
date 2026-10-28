import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // The Studio transform reads Kix's base image from disk; Vercel functions don't ship public/ by default.
  // Printable papers read skill packs from content/skills at request time (lib/print/bank.ts).
  outputFileTracingIncludes: {
    "/api/studio/transform": ["./public/art/kix/kix-base.webp"],
    ...Object.fromEntries(
      ["/papers", "/papers/[pack]", "/me/papers", "/me/papers/[pack]"].map((route) => [
        route,
        ["./content/skills/*/skill.json", "./content/skills/*/items/*.json", "./content/skills/*/figures/*"],
      ]),
    ),
    // Ask Kix reads the packs' teaching notes for the kid's level (lib/kix/homework.ts).
    "/api/kix/homework": ["./content/skills/*/SKILL.md", "./content/skills/*/references/*.md"],
    // The learning loop reads the frog quest items from disk at request time (lib/learn/frog-quest.ts).
    ...Object.fromEntries(
      ["/learn/[quest]", "/learn/[quest]/done", "/question/[id]", "/api/attempts", "/home"].map((route) => [route, ["./content/skills/p3-science/items/demo.json"]]),
    ),
  },
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
