import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import electron from "vite-plugin-electron/simple";

function copyLogoPlugin() {
  return {
    name: "copy-logo",
    buildStart() {
      const legacySource = path.resolve(__dirname, "ظ„ظˆط¬ظˆ ط£ظ†ظٹظ‚ ظ…ظˆط¯ط±ظ† ط¨ظٹط¬ ظˆط§ط³ظˆط¯ ظ„ظ…ظ†ط¸ظ… ط­ط¯ط«.png");
      const destDir = path.resolve(__dirname, "public");
      const dest = path.resolve(destDir, "logo.png");

      if (existsSync(legacySource)) {
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        copyFileSync(legacySource, dest);
        console.log("\x1b[32m✓ App logo copied to public/logo.png\x1b[0m");
        return;
      }

      if (existsSync(dest)) {
        console.log("\x1b[36mℹ Using existing public/logo.png\x1b[0m");
        return;
      }

      console.warn("\x1b[33m⚠ Logo file not found, skipping copy\x1b[0m");
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: mode === "e2e" ? "/" : "./",
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false,
    },
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"],
      },
      mangle: {
        toplevel: true,
        eval: true,
      },
      format: {
        comments: false,
      },
    },
  },
  plugins: [
    copyLogoPlugin(),
    react(),
    mode === "development" && componentTagger(),
    electron({
      main: {
        entry: "electron/main.ts",
        vite: {
          build: {
            rollupOptions: {
              external: ["electron", "better-sqlite3", "fs", "path", "url"],
            },
          },
        },
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
        vite: {
          build: {
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
      renderer: {},
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    entries: ["src/**/*.{ts,tsx}"],
    exclude: ["resources_extracted"],
  },
}));
