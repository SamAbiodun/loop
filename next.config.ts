import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The RealtimeSession (WebRTC + mic) is created once per interview mount;
  // Strict Mode's dev double-mount would tear it down mid-handshake, so keep
  // dev behavior identical to prod.
  reactStrictMode: false,
};

export default nextConfig;
