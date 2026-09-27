import { defineConfig } from "@playwright/test";
export default defineConfig({
	testDir: "tests",
	testMatch: "*.spec.ts",
	timeout: 90000,
	workers: 1,
	use: {
		baseURL:
			process.env.PLAYGROUND_URL ??
			"http://127.0.0.1:4173/expo-mediapipe-pose/",
		headless: true,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		launchOptions: {
			args: [
				"--use-fake-ui-for-media-stream",
				"--use-fake-device-for-media-stream",
			],
		},
	},
	webServer: process.env.PLAYGROUND_URL
		? undefined
		: {
				command: "pnpm preview --port 4173",
				url: "http://127.0.0.1:4173/expo-mediapipe-pose/",
				reuseExistingServer: !process.env.CI,
			},
});
