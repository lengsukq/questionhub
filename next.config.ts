import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 指定 Turbopack 工作区根目录，避免与用户主目录的 lockfile 混淆
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
