import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // мелкие картинки (текстуры страниц) встраиваются прямо в CSS
  build: { assetsInlineLimit: 16384 },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8787" },
  },
});
