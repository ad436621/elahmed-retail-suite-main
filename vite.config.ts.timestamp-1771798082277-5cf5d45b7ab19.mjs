// vite.config.ts
import { defineConfig } from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/vite/dist/node/index.js";
import react from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/lovable-tagger/dist/index.js";
import { copyFileSync, existsSync, mkdirSync } from "fs";
var __vite_injected_original_dirname = "e:\\\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0641\u0627\u0634\u0644\u0629\\elahmed-retail-suite-main";
function copyLogoPlugin() {
  return {
    name: "copy-logo",
    buildStart() {
      const src = path.resolve(
        __vite_injected_original_dirname,
        "\u0644\u0648\u062C\u0648 \u0623\u0646\u064A\u0642 \u0645\u0648\u062F\u0631\u0646 \u0628\u064A\u062C \u0648\u0627\u0633\u0648\u062F \u0644\u0645\u0646\u0638\u0645 \u062D\u062F\u062B.png"
      );
      const destDir = path.resolve(__vite_injected_original_dirname, "public");
      const dest = path.resolve(destDir, "logo.png");
      if (existsSync(src)) {
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        copyFileSync(src, dest);
        console.log("\x1B[32m\u2713 GX GLEAMEX logo copied to public/logo.png\x1B[0m");
      } else {
        console.warn("\x1B[33m\u26A0 Logo file not found, skipping copy\x1B[0m");
      }
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false
    }
  },
  plugins: [
    copyLogoPlugin(),
    react(),
    mode === "development" && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJlOlxcXFxcdTA2NDVcdTA2MzRcdTA2MzFcdTA2NDhcdTA2MzlcdTA2MjdcdTA2MkEgXHUwNjQxXHUwNjI3XHUwNjM0XHUwNjQ0XHUwNjI5XFxcXGVsYWhtZWQtcmV0YWlsLXN1aXRlLW1haW5cIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcImU6XFxcXFx1MDY0NVx1MDYzNFx1MDYzMVx1MDY0OFx1MDYzOVx1MDYyN1x1MDYyQSBcdTA2NDFcdTA2MjdcdTA2MzRcdTA2NDRcdTA2MjlcXFxcZWxhaG1lZC1yZXRhaWwtc3VpdGUtbWFpblxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vZTovJUQ5JTg1JUQ4JUI0JUQ4JUIxJUQ5JTg4JUQ4JUI5JUQ4JUE3JUQ4JUFBJTIwJUQ5JTgxJUQ4JUE3JUQ4JUI0JUQ5JTg0JUQ4JUE5L2VsYWhtZWQtcmV0YWlsLXN1aXRlLW1haW4vdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcbmltcG9ydCB7IGNvcHlGaWxlU3luYywgZXhpc3RzU3luYywgbWtkaXJTeW5jIH0gZnJvbSBcImZzXCI7XG5cbi8vIEN1c3RvbSBwbHVnaW46IGNvcGllcyB0aGUgR1ggR0xFQU1FWCBsb2dvIHRvIHB1YmxpYy9sb2dvLnBuZyBvbiBzdGFydHVwXG5mdW5jdGlvbiBjb3B5TG9nb1BsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcImNvcHktbG9nb1wiLFxuICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICBjb25zdCBzcmMgPSBwYXRoLnJlc29sdmUoXG4gICAgICAgIF9fZGlybmFtZSxcbiAgICAgICAgXCJcdTA2NDRcdTA2NDhcdTA2MkNcdTA2NDggXHUwNjIzXHUwNjQ2XHUwNjRBXHUwNjQyIFx1MDY0NVx1MDY0OFx1MDYyRlx1MDYzMVx1MDY0NiBcdTA2MjhcdTA2NEFcdTA2MkMgXHUwNjQ4XHUwNjI3XHUwNjMzXHUwNjQ4XHUwNjJGIFx1MDY0NFx1MDY0NVx1MDY0Nlx1MDYzOFx1MDY0NSBcdTA2MkRcdTA2MkZcdTA2MkIucG5nXCJcbiAgICAgICk7XG4gICAgICBjb25zdCBkZXN0RGlyID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJwdWJsaWNcIik7XG4gICAgICBjb25zdCBkZXN0ID0gcGF0aC5yZXNvbHZlKGRlc3REaXIsIFwibG9nby5wbmdcIik7XG4gICAgICBpZiAoZXhpc3RzU3luYyhzcmMpKSB7XG4gICAgICAgIGlmICghZXhpc3RzU3luYyhkZXN0RGlyKSkgbWtkaXJTeW5jKGRlc3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICBjb3B5RmlsZVN5bmMoc3JjLCBkZXN0KTtcbiAgICAgICAgY29uc29sZS5sb2coXCJcXHgxYlszMm1cdTI3MTMgR1ggR0xFQU1FWCBsb2dvIGNvcGllZCB0byBwdWJsaWMvbG9nby5wbmdcXHgxYlswbVwiKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnNvbGUud2FybihcIlxceDFiWzMzbVx1MjZBMCBMb2dvIGZpbGUgbm90IGZvdW5kLCBza2lwcGluZyBjb3B5XFx4MWJbMG1cIik7XG4gICAgICB9XG4gICAgfSxcbiAgfTtcbn1cblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiA4MDgwLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIGNvcHlMb2dvUGx1Z2luKCksXG4gICAgcmVhY3QoKSxcbiAgICBtb2RlID09PSBcImRldmVsb3BtZW50XCIgJiYgY29tcG9uZW50VGFnZ2VyKCksXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9YLFNBQVMsb0JBQW9CO0FBQ2paLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxjQUFjLFlBQVksaUJBQWlCO0FBSnBELElBQU0sbUNBQW1DO0FBT3pDLFNBQVMsaUJBQWlCO0FBQ3hCLFNBQU87QUFBQSxJQUNMLE1BQU07QUFBQSxJQUNOLGFBQWE7QUFDWCxZQUFNLE1BQU0sS0FBSztBQUFBLFFBQ2Y7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUNBLFlBQU0sVUFBVSxLQUFLLFFBQVEsa0NBQVcsUUFBUTtBQUNoRCxZQUFNLE9BQU8sS0FBSyxRQUFRLFNBQVMsVUFBVTtBQUM3QyxVQUFJLFdBQVcsR0FBRyxHQUFHO0FBQ25CLFlBQUksQ0FBQyxXQUFXLE9BQU8sRUFBRyxXQUFVLFNBQVMsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUNoRSxxQkFBYSxLQUFLLElBQUk7QUFDdEIsZ0JBQVEsSUFBSSxpRUFBNEQ7QUFBQSxNQUMxRSxPQUFPO0FBQ0wsZ0JBQVEsS0FBSywwREFBcUQ7QUFBQSxNQUNwRTtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7QUFHQSxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLEtBQUs7QUFBQSxNQUNILFNBQVM7QUFBQSxJQUNYO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsZUFBZTtBQUFBLElBQ2YsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQUEsRUFDNUMsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
