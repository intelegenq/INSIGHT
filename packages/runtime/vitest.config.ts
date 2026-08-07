import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@insight/intelligence": "/home/ubuntu/Insight/packages/intelligence/src/index.ts",
    },
  },
});
