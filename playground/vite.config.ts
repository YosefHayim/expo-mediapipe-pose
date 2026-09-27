import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
export default defineConfig({
	base: "/expo-mediapipe-pose/",
	resolve: {
		alias: {
			"expo-mediapipe-pose/core": fileURLToPath(
				new URL("../src/core.ts", import.meta.url),
			),
		},
	},
	worker: { format: "es" },
	build: { chunkSizeWarningLimit: 800 },
});
