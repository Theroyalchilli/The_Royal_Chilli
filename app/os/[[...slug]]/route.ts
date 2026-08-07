import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Serves the royal-chilli-os Restaurant OS SPA (a separate Vite/React app,
// built and copied into public/os/) at /os and every path under it. Static
// files under /os/assets and /os/gallery are served directly by Next.js's
// public-folder handling and never reach this route; this only exists to
// hand back the SPA's index.html for the "virtual" client-routed paths
// (e.g. /os/menu, /os/order) so react-router can take over — the standard
// SPA fallback pattern, since Next.js has no built-in equivalent for a
// bundled sub-app.
//
// To update: rebuild royal-chilli-os/web (npm run build), copy dist/* over
// public/os/, redeploy.
export async function GET() {
  const filePath = path.join(process.cwd(), "public", "os", "index.html");
  const html = fs.readFileSync(filePath, "utf-8");
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
