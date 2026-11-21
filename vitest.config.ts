import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const libraryDirectory = fileURLToPath(new URL("./src/", import.meta.url));

export default defineConfig({
	resolve: {
		alias: {
			"@/": libraryDirectory,
		},
	},
	test: {
		include: ["src/**/*.test.ts"],
	},
});
