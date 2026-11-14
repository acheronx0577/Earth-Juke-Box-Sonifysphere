import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/play", destination: "/challenge", permanent: false },
      { source: "/play/:path*", destination: "/challenge/:path*", permanent: false },
      { source: "/challenges", destination: "/challenge", permanent: false },
      { source: "/challenges/:path*", destination: "/challenge/:path*", permanent: false },
    ];
  },
};

export default nextConfig;
