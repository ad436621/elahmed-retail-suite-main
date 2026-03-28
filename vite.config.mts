import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import electron from "vite-plugin-electron/simple";

// Custom plugin: copies the GX GLEAMEX logo to public/logo.png on startup
function copyLogoPlugin() {
  return {
    name: "copy-logo",
    buildStart() {
      const src = path.resolve(
        __dirname,
        "لوجو أنيق مودرن بيج واسود لمنظم حدث.png"
      );
      const destDir = path.resolve(__dirname, "public");
      const dest = path.resolve(destDir, "logo.png");
      if (existsSync(src)) {
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        copyFileSync(src, dest);
        console.log("\x1b[32m✓ GX GLEAMEX logo copied to public/logo.png\x1b[0m");
      } else {
        console.warn("\x1b[33m⚠ Logo file not found, skipping copy\x1b[0m");
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false,
    },
  },
  build: {
    // Use terser for aggressive minification & obfuscation of the renderer bundle
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,         // Multiple compression passes
        drop_console: true, // Remove all console.log in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.warn', 'console.info'],
      },
      mangle: {
        toplevel: true,    // Mangle top-level variable/function names
        eval: true,
      },
      format: {
        comments: false,   // Remove all comments
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
              external: ['electron', 'better-sqlite3', 'fs', 'path', 'url'],
            }
          }
        }
      },
      preload: {
        input: path.join(__dirname, "electron/preload.ts"),
        vite: {
          build: {
            rollupOptions: {
              external: ['electron'],
            }
          }
        }
      },
      renderer: {},
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Prevent Vite from scanning resources_extracted/ (old Electron HTML/JS files)
  // which causes React to be bundled twice (dual-instance useState error)
  optimizeDeps: {
    entries: ["src/**/*.{ts,tsx}"],
    exclude: ["resources_extracted"],
  },
}));

