import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@afl/core", "@afl/db"],
};

export default nextConfig;
