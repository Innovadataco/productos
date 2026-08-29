import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
    test: {
        environment: "node",
        globals: true,
        include: ["tests/integration/**/*.test.ts"],
        testTimeout: 300_000,
        hookTimeout: 300_000,
        pool: "forks",
        env: {
            INTEGRATION: process.env.INTEGRATION || "0",
        },
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
});
