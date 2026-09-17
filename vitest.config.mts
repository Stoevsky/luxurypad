import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // These suites hit a rate-limited public RPC. Running files in parallel
    // trips the limiter and produces failures that say nothing about the code.
    fileParallelism: false,
    // .tsx is included so server components can be rendered to static markup
    // and asserted on. That needs no DOM — only a renderer — and it is the only
    // way to check that a degraded chain read shows "Unavailable" and not a 0.
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
