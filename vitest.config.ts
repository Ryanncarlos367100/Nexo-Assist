import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: false,
    env: {
      // Banco isolado para testes; falhas transitórias desligadas por padrão.
      DATABASE_PATH: "./data/test.db",
      TICKET_SERVICE_FAILURE_RATE: "0",
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
