import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
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
