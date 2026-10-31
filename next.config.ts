import type { NextConfig } from "next";
import { validateDemoPublicConfig } from "./src/lib/demoConfig";

validateDemoPublicConfig(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_KEY);
const nextConfig: NextConfig = {
  images: { unoptimized: true, remotePatterns: [{ protocol: "https", hostname: "ctbwaqtqubmjmltbxfzm.supabase.co", pathname: "/storage/v1/object/public/**" }] },
  async headers() { return [{ source: "/:path*", headers: [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Frame-Options", value: "DENY" },
  ] }]; },
};
export default nextConfig;
