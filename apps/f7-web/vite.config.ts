import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  ...(command === "serve" ? { resolve: { conditions: ["source"] } } : {}),
  server: {
    host: "127.0.0.1",
    port: 5177,
    strictPort: true,
    proxy: {
      "/f7": "http://127.0.0.1:4317",
    },
  },
}));
