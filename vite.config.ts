import devServer from "@hono/vite-dev-server"
import path from "path"
import { execFileSync } from "node:child_process"
const __dirname = import.meta.dirname
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// https://vite.dev/config/
const buildId = process.env.GITHUB_RUN_NUMBER || (() => {
  try { return execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }).trim(); }
  catch { return "local"; }
})();

export default defineConfig({
  define: { __LOCAT_BUILD_ID__: JSON.stringify(buildId) },
  plugins: [
    devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }),
    react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
  },
});
