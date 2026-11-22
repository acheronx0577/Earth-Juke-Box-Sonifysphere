import type { NextConfig } from "next";
import { publicAssetHeaders } from "./src/lib/staticCache";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // Negotiated documents only. The value keeps Next's RSC tokens so a later
    // replacement of Vary does not drop them, and adds Accept for the CDN.
    const negotiatedVary = [
      {
        key: "Vary",
        value: "rsc, next-router-state-tree, next-router-prefetch, next-router-segment-prefetch, Accept",
      },
    ];
    return [
      ...publicAssetHeaders(),
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      { source: "/", headers: negotiatedVary },
      { source: "/about", headers: negotiatedVary },
      { source: "/listen", headers: negotiatedVary },
      { source: "/challenge", headers: negotiatedVary },
      { source: "/contact", headers: negotiatedVary },
    ];
  },
  async redirects() {
    return [
      { source: "/play", destination: "/challenge", permanent: false },
      { source: "/play/:path*", destination: "/challenge/:path*", permanent: false },
      { source: "/challenges", destination: "/challenge", permanent: false },
      { source: "/challenges/:path*", destination: "/challenge/:path*", permanent: false },
      { source: "/credits", destination: "/about#credits-h", permanent: false },
      { source: "/credit", destination: "/about#credits-h", permanent: false },
    ];
  },
};

export default nextConfig;
