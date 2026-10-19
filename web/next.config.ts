import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The end-to-end tests build into a separate directory so they never replace the running app's build.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
