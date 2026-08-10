import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Routes pdfjs-dist's pre-built ESM (.mjs) through Next's own compiler
  // instead of treating it as an opaque dependency.
  transpilePackages: ["react-pdf", "pdfjs-dist"],
};

// Known issue: pdfjs-dist v5's ESM build throws "Object.defineProperty
// called on non-object" under `next dev`'s webpack (a documented pdfjs-dist/
// webpack interop bug, not specific to this app — transpilePackages above
// doesn't fully clear it in dev). Confirmed production is unaffected via a
// local `next build && next start` — the /menu PDF viewer renders and
// paginates correctly there. Test PDF-menu changes against a production
// build, not `next dev`, until upstream fixes this.

export default nextConfig;
