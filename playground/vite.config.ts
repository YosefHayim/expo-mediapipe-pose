import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const policy =
	"default-src 'self'; script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' blob: data:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; form-action 'none'";
const developmentPolicy = policy.replace(
	"connect-src 'self'",
	"connect-src 'self' ws://127.0.0.1:*",
);
export default defineConfig(({ command }) => ({
	base: "/expo-mediapipe-pose/",
	resolve: {
		alias: {
			"expo-mediapipe-pose/core": fileURLToPath(
				new URL("../src/core.ts", import.meta.url),
			),
		},
	},
	// Development workers are served as modules; they need their own response policy.
	server: { headers: { "Content-Security-Policy": developmentPolicy } },
	plugins: [
		{
			name: "playground-content-policy",
			transformIndexHtml(html) {
				return html.replace(
					"__CONTENT_SECURITY_POLICY__",
					command === "serve" ? developmentPolicy : policy,
				);
			},
		},
	],
	worker: { format: "es" },
	build: { chunkSizeWarningLimit: 800 },
}));
