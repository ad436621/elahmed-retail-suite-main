import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { copyFileSync, existsSync, mkdirSync } from "fs";

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
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    copyLogoPlugin(),
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
