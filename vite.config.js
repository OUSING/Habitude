import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Vite config — kept simple on purpose: `vite build` writes a static site to
// /dist that can be hosted anywhere.
export default defineConfig({
    base: './', // relative asset URLs, so the site works from any path or static host
    plugins: [react()],
    server: {
        host: true,
        port: 5173
    },
    build: {
        outDir: "dist",
        sourcemap: true
    }
});
