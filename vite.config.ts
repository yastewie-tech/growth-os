import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Вот эта часть соединяет Фронтенд и Бэкенд
    proxy: {
      "/api": {
        target: "http://0.0.0.0:5001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});