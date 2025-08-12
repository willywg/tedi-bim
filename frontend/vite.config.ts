import path from "node:path"
import { TanStackRouterVite } from "@tanstack/router-vite-plugin"
import react from "@vitejs/plugin-react-swc"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Shim for web-ifc-three expecting mergeGeometries symbol in BufferGeometryUtils
      // NOTE: We only alias the extensionless path used by web-ifc-three to avoid recursion in the shim.
      "three/examples/jsm/utils/BufferGeometryUtils": path.resolve(
        __dirname,
        "./src/shims/three-buffer-merge.js",
      ),
    },
  },
  plugins: [react(), TanStackRouterVite()],
})
