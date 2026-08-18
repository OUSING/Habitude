import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Vite config — kept simple on purpose so `vite build` output in /dist
// can be dropped straight into Capacitor's webDir.
export default defineConfig({
    base: './', // 👈 AJOUTÉ : Indispensable pour que Capacitor trouve les fichiers sur Android
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
