import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Session creation now happens only from the Start gesture, so Strict Mode's
  // development effect checks are safe and useful again.
  reactStrictMode: true,
  // Keep generated agent-instruction files out of application worktrees.
  agentRules: false,
};

export default nextConfig;
