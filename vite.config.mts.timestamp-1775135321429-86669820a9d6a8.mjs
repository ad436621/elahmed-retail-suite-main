// vite.config.mts
import { defineConfig } from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/vite/dist/node/index.js";
import react from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
import { componentTagger } from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/lovable-tagger/dist/index.js";
import { copyFileSync, existsSync, mkdirSync } from "fs";
import electron from "file:///E:/%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D8%A7%D8%AA%20%D9%81%D8%A7%D8%B4%D9%84%D8%A9/elahmed-retail-suite-main/node_modules/vite-plugin-electron/dist/simple.mjs";
var __vite_injected_original_dirname = "E:\\\u0645\u0634\u0631\u0648\u0639\u0627\u062A \u0641\u0627\u0634\u0644\u0629\\elahmed-retail-suite-main";
function copyLogoPlugin() {
  return {
    name: "copy-logo",
    buildStart() {
      const legacySource = path.resolve(__vite_injected_original_dirname, "\u0638\u201E\u0638\u02C6\u0637\xAC\u0638\u02C6 \u0637\xA3\u0638\u2020\u0638\u0679\u0638\u201A \u0638\u2026\u0638\u02C6\u0637\xAF\u0637\xB1\u0638\u2020 \u0637\xA8\u0638\u0679\u0637\xAC \u0638\u02C6\u0637\xA7\u0637\xB3\u0638\u02C6\u0637\xAF \u0638\u201E\u0638\u2026\u0638\u2020\u0637\xB8\u0638\u2026 \u0637\xAD\u0637\xAF\u0637\xAB.png");
      const destDir = path.resolve(__vite_injected_original_dirname, "public");
      const dest = path.resolve(destDir, "logo.png");
      if (existsSync(legacySource)) {
        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        copyFileSync(legacySource, dest);
        console.log("\x1B[32m\u2713 App logo copied to public/logo.png\x1B[0m");
        return;
      }
      if (existsSync(dest)) {
        console.log("\x1B[36m\u2139 Using existing public/logo.png\x1B[0m");
        return;
      }
      console.warn("\x1B[33m\u26A0 Logo file not found, skipping copy\x1B[0m");
    }
  };
}
var vite_config_default = defineConfig(({ mode }) => ({
  base: mode === "e2e" ? "/" : "./",
  server: {
    host: "::",
    port: 8081,
    hmr: {
      overlay: false
    }
  },
  build: {
    minify: "terser",
    terserOptions: {
      compress: {
        passes: 3,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.warn", "console.info"]
      },
      mangle: {
        toplevel: true,
        eval: true
      },
      format: {
        comments: false
      }
    }
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
              external: ["electron", "better-sqlite3", "fs", "path", "url"]
            }
          }
        }
      },
      preload: {
        input: path.join(__vite_injected_original_dirname, "electron/preload.ts"),
        vite: {
          build: {
            rollupOptions: {
              external: ["electron"]
            }
          }
        }
      },
      renderer: {}
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  optimizeDeps: {
    entries: ["src/**/*.{ts,tsx}"],
    exclude: ["resources_extracted"]
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcubXRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiRTpcXFxcXHUwNjQ1XHUwNjM0XHUwNjMxXHUwNjQ4XHUwNjM5XHUwNjI3XHUwNjJBIFx1MDY0MVx1MDYyN1x1MDYzNFx1MDY0NFx1MDYyOVxcXFxlbGFobWVkLXJldGFpbC1zdWl0ZS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJFOlxcXFxcdTA2NDVcdTA2MzRcdTA2MzFcdTA2NDhcdTA2MzlcdTA2MjdcdTA2MkEgXHUwNjQxXHUwNjI3XHUwNjM0XHUwNjQ0XHUwNjI5XFxcXGVsYWhtZWQtcmV0YWlsLXN1aXRlLW1haW5cXFxcdml0ZS5jb25maWcubXRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9FOi8lRDklODUlRDglQjQlRDglQjElRDklODglRDglQjklRDglQTclRDglQUElMjAlRDklODElRDglQTclRDglQjQlRDklODQlRDglQTkvZWxhaG1lZC1yZXRhaWwtc3VpdGUtbWFpbi92aXRlLmNvbmZpZy5tdHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBjb21wb25lbnRUYWdnZXIgfSBmcm9tIFwibG92YWJsZS10YWdnZXJcIjtcbmltcG9ydCB7IGNvcHlGaWxlU3luYywgZXhpc3RzU3luYywgbWtkaXJTeW5jIH0gZnJvbSBcImZzXCI7XG5pbXBvcnQgZWxlY3Ryb24gZnJvbSBcInZpdGUtcGx1Z2luLWVsZWN0cm9uL3NpbXBsZVwiO1xuXG5mdW5jdGlvbiBjb3B5TG9nb1BsdWdpbigpIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBcImNvcHktbG9nb1wiLFxuICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICBjb25zdCBsZWdhY3lTb3VyY2UgPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIlx1MDYzOFx1MjAxRVx1MDYzOFx1MDJDNlx1MDYzN1x1MDBBQ1x1MDYzOFx1MDJDNiBcdTA2MzdcdTAwQTNcdTA2MzhcdTIwMjBcdTA2MzhcdTA2NzlcdTA2MzhcdTIwMUEgXHUwNjM4XHUyMDI2XHUwNjM4XHUwMkM2XHUwNjM3XHUwMEFGXHUwNjM3XHUwMEIxXHUwNjM4XHUyMDIwIFx1MDYzN1x1MDBBOFx1MDYzOFx1MDY3OVx1MDYzN1x1MDBBQyBcdTA2MzhcdTAyQzZcdTA2MzdcdTAwQTdcdTA2MzdcdTAwQjNcdTA2MzhcdTAyQzZcdTA2MzdcdTAwQUYgXHUwNjM4XHUyMDFFXHUwNjM4XHUyMDI2XHUwNjM4XHUyMDIwXHUwNjM3XHUwMEI4XHUwNjM4XHUyMDI2IFx1MDYzN1x1MDBBRFx1MDYzN1x1MDBBRlx1MDYzN1x1MDBBQi5wbmdcIik7XG4gICAgICBjb25zdCBkZXN0RGlyID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCJwdWJsaWNcIik7XG4gICAgICBjb25zdCBkZXN0ID0gcGF0aC5yZXNvbHZlKGRlc3REaXIsIFwibG9nby5wbmdcIik7XG5cbiAgICAgIGlmIChleGlzdHNTeW5jKGxlZ2FjeVNvdXJjZSkpIHtcbiAgICAgICAgaWYgKCFleGlzdHNTeW5jKGRlc3REaXIpKSB7XG4gICAgICAgICAgbWtkaXJTeW5jKGRlc3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICB9XG4gICAgICAgIGNvcHlGaWxlU3luYyhsZWdhY3lTb3VyY2UsIGRlc3QpO1xuICAgICAgICBjb25zb2xlLmxvZyhcIlxceDFiWzMybVx1MjcxMyBBcHAgbG9nbyBjb3BpZWQgdG8gcHVibGljL2xvZ28ucG5nXFx4MWJbMG1cIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgaWYgKGV4aXN0c1N5bmMoZGVzdCkpIHtcbiAgICAgICAgY29uc29sZS5sb2coXCJcXHgxYlszNm1cdTIxMzkgVXNpbmcgZXhpc3RpbmcgcHVibGljL2xvZ28ucG5nXFx4MWJbMG1cIik7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc29sZS53YXJuKFwiXFx4MWJbMzNtXHUyNkEwIExvZ28gZmlsZSBub3QgZm91bmQsIHNraXBwaW5nIGNvcHlcXHgxYlswbVwiKTtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xuICBiYXNlOiBtb2RlID09PSBcImUyZVwiID8gXCIvXCIgOiBcIi4vXCIsXG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiA4MDgxLFxuICAgIGhtcjoge1xuICAgICAgb3ZlcmxheTogZmFsc2UsXG4gICAgfSxcbiAgfSxcbiAgYnVpbGQ6IHtcbiAgICBtaW5pZnk6IFwidGVyc2VyXCIsXG4gICAgdGVyc2VyT3B0aW9uczoge1xuICAgICAgY29tcHJlc3M6IHtcbiAgICAgICAgcGFzc2VzOiAzLFxuICAgICAgICBkcm9wX2NvbnNvbGU6IHRydWUsXG4gICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXG4gICAgICAgIHB1cmVfZnVuY3M6IFtcImNvbnNvbGUubG9nXCIsIFwiY29uc29sZS53YXJuXCIsIFwiY29uc29sZS5pbmZvXCJdLFxuICAgICAgfSxcbiAgICAgIG1hbmdsZToge1xuICAgICAgICB0b3BsZXZlbDogdHJ1ZSxcbiAgICAgICAgZXZhbDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBmb3JtYXQ6IHtcbiAgICAgICAgY29tbWVudHM6IGZhbHNlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBwbHVnaW5zOiBbXG4gICAgY29weUxvZ29QbHVnaW4oKSxcbiAgICByZWFjdCgpLFxuICAgIG1vZGUgPT09IFwiZGV2ZWxvcG1lbnRcIiAmJiBjb21wb25lbnRUYWdnZXIoKSxcbiAgICBlbGVjdHJvbih7XG4gICAgICBtYWluOiB7XG4gICAgICAgIGVudHJ5OiBcImVsZWN0cm9uL21haW4udHNcIixcbiAgICAgICAgdml0ZToge1xuICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGV4dGVybmFsOiBbXCJlbGVjdHJvblwiLCBcImJldHRlci1zcWxpdGUzXCIsIFwiZnNcIiwgXCJwYXRoXCIsIFwidXJsXCJdLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHByZWxvYWQ6IHtcbiAgICAgICAgaW5wdXQ6IHBhdGguam9pbihfX2Rpcm5hbWUsIFwiZWxlY3Ryb24vcHJlbG9hZC50c1wiKSxcbiAgICAgICAgdml0ZToge1xuICAgICAgICAgIGJ1aWxkOiB7XG4gICAgICAgICAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICAgICAgICAgIGV4dGVybmFsOiBbXCJlbGVjdHJvblwiXSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICByZW5kZXJlcjoge30sXG4gICAgfSksXG4gIF0uZmlsdGVyKEJvb2xlYW4pLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGVudHJpZXM6IFtcInNyYy8qKi8qLnt0cyx0c3h9XCJdLFxuICAgIGV4Y2x1ZGU6IFtcInJlc291cmNlc19leHRyYWN0ZWRcIl0sXG4gIH0sXG59KSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXNYLFNBQVMsb0JBQW9CO0FBQ25aLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFDakIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxjQUFjLFlBQVksaUJBQWlCO0FBQ3BELE9BQU8sY0FBYztBQUxyQixJQUFNLG1DQUFtQztBQU96QyxTQUFTLGlCQUFpQjtBQUN4QixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixhQUFhO0FBQ1gsWUFBTSxlQUFlLEtBQUssUUFBUSxrQ0FBVyw4VUFBc0U7QUFDbkgsWUFBTSxVQUFVLEtBQUssUUFBUSxrQ0FBVyxRQUFRO0FBQ2hELFlBQU0sT0FBTyxLQUFLLFFBQVEsU0FBUyxVQUFVO0FBRTdDLFVBQUksV0FBVyxZQUFZLEdBQUc7QUFDNUIsWUFBSSxDQUFDLFdBQVcsT0FBTyxHQUFHO0FBQ3hCLG9CQUFVLFNBQVMsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUFBLFFBQ3hDO0FBQ0EscUJBQWEsY0FBYyxJQUFJO0FBQy9CLGdCQUFRLElBQUksMERBQXFEO0FBQ2pFO0FBQUEsTUFDRjtBQUVBLFVBQUksV0FBVyxJQUFJLEdBQUc7QUFDcEIsZ0JBQVEsSUFBSSxzREFBaUQ7QUFDN0Q7QUFBQSxNQUNGO0FBRUEsY0FBUSxLQUFLLDBEQUFxRDtBQUFBLElBQ3BFO0FBQUEsRUFDRjtBQUNGO0FBRUEsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE9BQU87QUFBQSxFQUN6QyxNQUFNLFNBQVMsUUFBUSxNQUFNO0FBQUEsRUFDN0IsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sS0FBSztBQUFBLE1BQ0gsU0FBUztBQUFBLElBQ1g7QUFBQSxFQUNGO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsSUFDUixlQUFlO0FBQUEsTUFDYixVQUFVO0FBQUEsUUFDUixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxlQUFlO0FBQUEsUUFDZixZQUFZLENBQUMsZUFBZSxnQkFBZ0IsY0FBYztBQUFBLE1BQzVEO0FBQUEsTUFDQSxRQUFRO0FBQUEsUUFDTixVQUFVO0FBQUEsUUFDVixNQUFNO0FBQUEsTUFDUjtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sVUFBVTtBQUFBLE1BQ1o7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsZUFBZTtBQUFBLElBQ2YsTUFBTTtBQUFBLElBQ04sU0FBUyxpQkFBaUIsZ0JBQWdCO0FBQUEsSUFDMUMsU0FBUztBQUFBLE1BQ1AsTUFBTTtBQUFBLFFBQ0osT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUFBLFVBQ0osT0FBTztBQUFBLFlBQ0wsZUFBZTtBQUFBLGNBQ2IsVUFBVSxDQUFDLFlBQVksa0JBQWtCLE1BQU0sUUFBUSxLQUFLO0FBQUEsWUFDOUQ7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNQLE9BQU8sS0FBSyxLQUFLLGtDQUFXLHFCQUFxQjtBQUFBLFFBQ2pELE1BQU07QUFBQSxVQUNKLE9BQU87QUFBQSxZQUNMLGVBQWU7QUFBQSxjQUNiLFVBQVUsQ0FBQyxVQUFVO0FBQUEsWUFDdkI7QUFBQSxVQUNGO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLFVBQVUsQ0FBQztBQUFBLElBQ2IsQ0FBQztBQUFBLEVBQ0gsRUFBRSxPQUFPLE9BQU87QUFBQSxFQUNoQixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsbUJBQW1CO0FBQUEsSUFDN0IsU0FBUyxDQUFDLHFCQUFxQjtBQUFBLEVBQ2pDO0FBQ0YsRUFBRTsiLAogICJuYW1lcyI6IFtdCn0K
