import type { NextConfig } from "next";
import path from "node:path";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : undefined;

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack ignores stray lockfiles higher in $HOME.
  turbopack: {
    root: path.join(__dirname),
  },
  // Allow next/image to serve headshots from Supabase Storage (public bucket).
  images: {
    remotePatterns: [
      // Avatars placeholder (filet de sécurité).
      { hostname: "placehold.co" },
      // Headshots depuis Supabase Storage (bucket public), local ou prod.
      ...(supabaseHost
        ? [{ hostname: supabaseHost, pathname: "/storage/v1/object/public/**" }]
        : []),
    ],
  },
  experimental: {
    serverActions: {
      // Headshots can be a few MB; raise the default 1 MB Server Action limit.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
