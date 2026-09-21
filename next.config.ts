import type { NextConfig } from "next";

// Staff-uploaded images (hero banner, featured dishes) are served from
// Supabase Storage's public bucket URL, a different host than the app's
// own domain — next/image refuses to optimize an unlisted remote host.
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl ? new URL(supabaseUrl).hostname : "xmsgkshtgtdkdbmkhmep.supabase.co";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: supabaseHostname, pathname: "/storage/v1/object/public/**" },
    ],
  },
};

export default nextConfig;
