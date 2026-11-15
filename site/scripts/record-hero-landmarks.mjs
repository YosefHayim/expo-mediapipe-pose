import { createReadStream, existsSync, statSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const require = createRequire(import.meta.url);
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const visionRoot = dirname(require.resolve("@mediapipe/tasks-vision"));
const framesPerSecond = 30;
const videoWidth = 1280;
const videoHeight = 720;
const outputFile = resolve(siteRoot, "media/hero-landmarks.json");

const servedFiles = {
	"/clip.mp4": resolve(siteRoot, "media/hero-clip.mp4"),
	"/pose_landmarker_full.task": resolve(
		siteRoot,
		"../assets/pose_landmarker_full.task",
	),
	"/vision_bundle.mjs": resolve(visionRoot, "vision_bundle.mjs"),
};
const contentTypes = {
	".mp4": "video/mp4",
	".mjs": "text/javascript",
	".js": "text/javascript",
	".wasm": "application/wasm",
	".task": "application/octet-stream",
};
const pageHtml =
	"<!doctype html><title>record</title><video id=v muted playsinline></video>";

const resolveRequestFile = (pathname) => {
	const isWasmPath = pathname.startsWith("/wasm/");
	const wasmFile = resolve(visionRoot, `.${pathname}`);
	const isWasmFileSafe = wasmFile.startsWith(resolve(visionRoot, "wasm"));
	if (isWasmPath && isWasmFileSafe) return wasmFile;
	return servedFiles[pathname];
};

const server = createServer((request, response) => {
	const { pathname } = new URL(request.url, "http://127.0.0.1");
	const isPage = pathname === "/";
	if (isPage) {
		response.writeHead(200, { "content-type": "text/html" });
		response.end(pageHtml);
		return;
	}
	const file = resolveRequestFile(pathname);
	const isFileServable = file !== undefined && existsSync(file);
	if (!isFileServable) {
		response.writeHead(404).end();
		return;
	}
	response.writeHead(200, {
		"content-type": contentTypes[extname(file)] ?? "application/octet-stream",
		"content-length": statSync(file).size,
	});
	createReadStream(file).pipe(response);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const { port } = server.address();

const launchBrowser = async () => {
	try {
		return await chromium.launch();
	} catch {
		return chromium.launch({ channel: "chrome" });
	}
};

const recordInPage = async ({ fps, width, height }) => {
	const vision = await import("/vision_bundle.mjs");
	const fileset = await vision.FilesetResolver.forVisionTasks("/wasm");
	const detector = await vision.PoseLandmarker.createFromOptions(fileset, {
		baseOptions: {
			modelAssetPath: "/pose_landmarker_full.task",
			delegate: "CPU",
		},
		runningMode: "VIDEO",
		numPoses: 1,
	});
	const video = document.getElementById("v");
	video.src = "/clip.mp4";
	await new Promise((done, fail) => {
		video.onloadeddata = done;
		video.onerror = () => fail(new Error("The clip failed to load."));
	});
	const frameCount = Math.round(video.duration * fps);
	const round = (number) => Math.round(number * 10000) / 10000;
	const frames = new Array(frameCount).fill(null);
	const finished = new Promise((done) => {
		video.onended = done;
	});
	const detectPresentedFrame = (_now, frameInfo) => {
		const index = Math.min(
			Math.round(frameInfo.mediaTime * fps),
			frameCount - 1,
		);
		const timestamp = Math.round(frameInfo.mediaTime * 1000) + 1;
		const detection = detector.detectForVideo(video, timestamp);
		const [pose] = detection.landmarks;
		const isPoseFound = pose !== undefined;
		frames[index] = isPoseFound
			? pose.flatMap((point) => [
					round(point.x),
					round(point.y),
					round(point.visibility ?? 0),
				])
			: [];
		video.requestVideoFrameCallback(detectPresentedFrame);
	};
	video.requestVideoFrameCallback(detectPresentedFrame);
	// Slow playback so no frame is dropped; each presented frame is read once.
	video.playbackRate = 0.25;
	await video.play();
	await finished;
	// The browser may skip a frame at the very start or end; repeat the nearest read one.
	const filledFrames = frames.map((frame, index) => {
		const previousFrame = frames
			.slice(0, index)
			.reverse()
			.find((other) => other !== null);
		const nextFrame = frames.slice(index).find((other) => other !== null);
		return frame ?? previousFrame ?? nextFrame;
	});
	detector.close();
	return {
		version: 1,
		fps,
		width,
		height,
		durationMs: Math.round(video.duration * 1000),
		frames: filledFrames,
	};
};

const browser = await launchBrowser();
try {
	const page = await browser.newPage();
	page.on("pageerror", (error) => console.error(error.message));
	await page.goto(`http://127.0.0.1:${port}/`);
	const recording = await page.evaluate(recordInPage, {
		fps: framesPerSecond,
		width: videoWidth,
		height: videoHeight,
	});
	await writeFile(outputFile, JSON.stringify(recording));
	const framesWithPose = recording.frames.filter(
		(frame) => frame.length > 0,
	).length;
	console.log(
		`Recorded ${recording.frames.length} frames, ${framesWithPose} with a pose, to media/hero-landmarks.json`,
	);
} finally {
	await browser.close();
	server.close();
}
