// FILE: web/vite.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router-dom")) return "router";
          if (id.includes("react-dom") || id.includes("react")) return "react";
          if (id.includes("axios") || id.includes("react-hot-toast")) return "vendor";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => {
          console.log(`[PROXY] Forwarding: ${path}`);
          return path;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    testTimeout: 20000,
    fakeTimers: {
      now: 1776247200000,
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      exclude: [
        "src/test/**",
        "**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 75,
        statements: 90,
      },
    },
  },
});
