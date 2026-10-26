import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle so
  // Next/Turbopack does not try to bundle the .node binary.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
