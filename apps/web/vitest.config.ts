import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts", "app/**/*.test.ts", "lib/**/*.test.ts"],
    globals: false,
  },
  plugins: [tsconfigPaths()],
});