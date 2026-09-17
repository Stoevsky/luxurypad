import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // These suites hit a rate-limited public RPC. Running files in parallel
    // trips the limiter and produces failures that say nothing about the code.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
