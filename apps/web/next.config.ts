import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@afl/core", "@afl/db", "@afl/agents"],
  serverExternalPackages: [],
};

export default nextConfig;
