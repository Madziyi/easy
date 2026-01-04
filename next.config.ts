import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "database.195.35.7.227.sslip.io",
      },
      {
        protocol: "https",
        hostname: "database.195.35.7.227.sslip.io",
      },
    ],
  },
};

export default nextConfig;
