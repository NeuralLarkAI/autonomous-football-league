import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@afl/core", "@afl/db", "@afl/agents"],
  // Prisma and native modules should be treated as external on the server
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
