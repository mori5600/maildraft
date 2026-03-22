import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const tauriConfig = JSON.parse(
  readFileSync(fileURLToPath(new URL("./src-tauri/tauri.conf.json", import.meta.url)), "utf8"),
) as { productName: string; version: string };

function resolveManualChunk(id: string): string | undefined {
  if (!id.includes("node_modules")) {
    return undefined;
  }

  if (id.includes("@codemirror/")) {
    return "codemirror";
  }

  if (
    id.includes("/react/") ||
    id.includes("\\react\\") ||
    id.includes("/react-dom/") ||
    id.includes("\\react-dom\\") ||
    id.includes("/scheduler/") ||
    id.includes("\\scheduler\\")
  ) {
    return "react-vendor";
  }

  if (id.includes("@tauri-apps/")) {
    return "tauri-vendor";
  }

  return "vendor";
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  build: {
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
      },
    },
  },
  optimizeDeps: {
    // Avoid scanning generated Rust docs under src-tauri/target/doc during dev startup.
    entries: ["index.html"],
  },
  define: {
    __APP_NAME__: JSON.stringify(tauriConfig.productName),
    __APP_VERSION__: JSON.stringify(tauriConfig.version),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      assert: fileURLToPath(
        new URL("./src/shared/lib/browser-node-shims/assert.cjs", import.meta.url),
      ),
      fs: fileURLToPath(new URL("./src/shared/lib/browser-node-shims/fs.ts", import.meta.url)),
      "node:assert": fileURLToPath(
        new URL("./src/shared/lib/browser-node-shims/assert.cjs", import.meta.url),
      ),
      path: fileURLToPath(new URL("./src/shared/lib/browser-node-shims/path.ts", import.meta.url)),
      "node:os": fileURLToPath(
        new URL("./src/shared/lib/browser-node-shims/os.ts", import.meta.url),
      ),
      "node:path": fileURLToPath(
        new URL("./src/shared/lib/browser-node-shims/path.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
  worker: {
    format: "es",
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
