import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const repoName = "autonomous-football-league";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? `/${repoName}` : "",
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ["@afl/core"],
};

export default nextConfig;
