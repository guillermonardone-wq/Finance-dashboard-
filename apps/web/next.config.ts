import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@racing-coach/db", "@racing-coach/types"],
};

export default nextConfig;
