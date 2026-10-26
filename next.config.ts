import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module; keep it external to the server bundle so
  // Next/Turbopack does not try to bundle the .node binary.
  serverExternalPackages: ["better-sqlite3"],
  // Fixa a raiz do projeto (há um lockfile no diretório home que confunde a
  // detecção automática do Next).
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
