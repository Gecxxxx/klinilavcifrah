import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { resolveSiteUrl } from "./src/lib/site-url";

// Fail before generating any output when a production origin is misconfigured.
resolveSiteUrl();

if (process.env.CLOUDFLARE_DEV === "true") {
  initOpenNextCloudflareForDev();
}

const nextConfig: NextConfig = {
  ...(process.env.CLOUDFLARE_PAGES_STATIC === "true"
    ? { output: "export" as const }
    : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: process.cwd() },
  images: {
    formats: ["image/avif", "image/webp"],
    // A static Pages export has no `/_next/image` runtime endpoint.
    // Serve files from `public` directly when building the Pages site.
    unoptimized: process.env.CLOUDFLARE_PAGES_STATIC === "true",
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
