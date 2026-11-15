import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
