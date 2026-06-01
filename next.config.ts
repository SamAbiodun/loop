import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["realtime-voice-component"],
  // realtime-voice-component permanently destroys its controller on unmount;
  // Strict Mode's dev double-mount leaves a dead controller and connect() no-ops.
  reactStrictMode: false,
};

export default nextConfig;
