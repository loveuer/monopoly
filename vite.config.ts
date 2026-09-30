import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1" },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (
            [
              "/node_modules/react/",
              "/node_modules/react-dom/",
              "/node_modules/scheduler/",
            ].some((path) => id.includes(path))
          )
            return "react";
          if (id.includes("/node_modules/three/")) return "three";
          if (
            id.includes("/node_modules/@react-three/") ||
            id.includes("/node_modules/three-stdlib/")
          )
            return "scene";
        },
      },
    },
  },
});
