import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "workbench.js",
        assetFileNames: (asset) => asset.name?.endsWith(".css") === true ? "workbench.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});