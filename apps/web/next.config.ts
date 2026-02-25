import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@afl/core", "@afl/db", "@afl/agents"],
  // Prisma and native modules should be treated as external on the server
  serverExternalPackages: ["@prisma/client", "prisma"],
  eslint: {
    // ESLint runs separately in CI; skip it during next build to avoid
    // breaking production deploys on lint-only warnings.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
