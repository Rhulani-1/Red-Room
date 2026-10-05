import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    port: 8080,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    minify: "esbuild",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            // Sentry is loaded through a dynamic import and only when
            // VITE_SENTRY_DSN is set. Forcing it into the eager `vendor` chunk
            // would defeat that and ship ~165 kB gzipped to every visitor,
            // including those with monitoring switched off. Leave it unassigned
            // so it stays its own lazily-fetched chunk.
            if (id.includes("@sentry")) return;
            return "vendor";
          }
        },
      },
    },
  },
  esbuild: {
    // Drop debug noise, but KEEP console.warn/error in production. Dropping the
    // whole console also removed genuine diagnostics — a malformed Sentry DSN or an
    // unrecognised origin then failed silently in the one environment where you most
    // need to be told. Chatty logs go, signals stay.
    drop: mode === "production" ? ["debugger"] : [],
    pure: mode === "production" ? ["console.log", "console.debug", "console.info", "console.trace"] : [],
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
