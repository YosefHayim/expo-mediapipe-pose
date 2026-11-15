import type { StatusKind } from "@/landing/compare/status-mark";

type CompareCell = {
	status: StatusKind;
	text: string;
};

export type CompareRow = {
	id: string;
	feature: string;
	browser: CompareCell;
	native: CompareCell;
};

/** Every row comes from README.md, site/README.md or SKILL.md. */
export const COMPARE_ROWS: readonly CompareRow[] = [
	{
		id: "runtime",
		feature: "Model runtime",
		browser: {
			status: "partial",
			text: "MediaPipe's browser SDK on a CPU WASM worker, one frame in flight.",
		},
		native: {
			status: "yes",
			text: "Google's MediaPipe Tasks SDKs, in Swift on iOS and Kotlin on Android.",
		},
	},
	{
		id: "camera",
		feature: "Live camera",
		browser: {
			status: "yes",
			text: "Webcam through the browser's own device list.",
		},
		native: {
			status: "yes",
			text: "A camera view with front or back camera, lens and zoom controls.",
		},
	},
	{
		id: "frame-rate",
		feature: "Frame rate",
		browser: {
			status: "partial",
			text: "A best-effort target. The capture settings actually applied are shown.",
		},
		native: {
			status: "yes",
			text: "previewFps, frameLimit and callbackFps are set apart. Metrics report observed work, never a promise.",
		},
	},
	{
		id: "files",
		feature: "Photos and video files",
		browser: {
			status: "partial",
			text: "Resized to 1280 px, up to 200 MiB. Video is sampled during playback and skips frames under load.",
		},
		native: {
			status: "yes",
			text: "Local image and video analysis, with a file-sampling API that reads every sampled frame.",
		},
	},
	{
		id: "masks",
		feature: "Body masks",
		browser: {
			status: "partial",
			text: "Copied into bounded alpha buffers. It does not test native mask limits.",
		},
		native: {
			status: "yes",
			text: "Opt-in. At most two mask leases per module, each owning bounded PNG files.",
		},
	},
	{
		id: "recording",
		feature: "Landmark recording",
		browser: {
			status: "partial",
			text: "Stops at 1,800 frames or 15 MiB. Browser exports are not native recordings.",
		},
		native: {
			status: "yes",
			text: "Record and replay bounded landmark sessions. Landmarks and metadata only, no camera video.",
		},
	},
	{
		id: "models",
		feature: "Pose models",
		browser: {
			status: "partial",
			text: "The full model is bundled. Lite and heavy need your own local .task file.",
		},
		native: {
			status: "partial",
			text: "Only the full model is bundled. Lite and heavy need a local model file.",
		},
	},
	{
		id: "frames",
		feature: "Where frames go",
		browser: {
			status: "yes",
			text: "Stay in your browser. No accounts, backend or analytics.",
		},
		native: {
			status: "yes",
			text: "Stay on the device. No upload, and no model download.",
		},
	},
	{
		id: "app",
		feature: "Inside your app",
		browser: {
			status: "no",
			text: "A playground only. The npm package has no browser inference.",
		},
		native: {
			status: "yes",
			text: "Needs an iOS or Android development build. Expo Go cannot load it.",
		},
	},
];
