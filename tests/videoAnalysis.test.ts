import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { test } from "node:test";
import { createVideoSamplePlan, resolvePoseVideoOptions } from "../src/core";

test("video sampling is bounded, monotonic and excludes the range end", () => {
	const plan = createVideoSamplePlan(1000, { samplingFps: 30 });
	const times = Array.from({ length: plan.frameCount }, (_, index) =>
		plan.timestampAt(index),
	);
	assert.equal(times.length, 30);
	assert.deepEqual(times.slice(0, 4), [0, 33, 66, 100]);
	assert.equal(times.at(-1), 966);
	assert.equal(new Set(times).size, 30);
	assert.throws(() => plan.timestampAt(-1));
	assert.throws(() => plan.timestampAt(30));
	const ranged = createVideoSamplePlan(5000, {
		startMs: 200,
		endMs: 1201,
		samplingFps: 2,
	});
	assert.deepEqual(
		Array.from({ length: ranged.frameCount }, (_, i) => ranged.timestampAt(i)),
		[200, 700, 1200],
	);
	assert.throws(() => createVideoSamplePlan(1000, { startMs: 1000 }));
	assert.throws(() => createVideoSamplePlan(1000, { endMs: 1001 }));
	assert.throws(
		() => createVideoSamplePlan(1_000_000, { maxFrames: 1 }),
		/maxFrames/,
	);
	assert.throws(() => createVideoSamplePlan(Infinity));
	assert.throws(() => resolvePoseVideoOptions({ samplingFps: 61 }));
	assert.throws(() => resolvePoseVideoOptions({ minTrackingConfidence: -1 }));
});

test("video bridge applies backpressure and closes on completion, break, error and cancellation", async () => {
	assert.equal(
		typeof nodeModule.registerHooks,
		"function",
		"Contributor tests require Node 24 LTS",
	);
	const calls: Array<string | number> = [];
	let failRead = false;
	let releaseRead: (() => void) | undefined;
	let blockRead = false;
	let opened = false;
	const mockKey = Symbol.for("pose.nativeVideoTest");
	Object.defineProperty(globalThis, mockKey, {
		configurable: true,
		value: {
			async openPoseVideo() {
				calls.push("open");
				opened = true;
				return { id: "session", durationMs: 1000 };
			},
			async closePoseVideo() {
				calls.push("close");
				opened = false;
			},
			async readPoseVideoFrame(_id: string, timestampMs: number) {
				calls.push(timestampMs);
				if (blockRead)
					await new Promise<void>((resolve) => {
						releaseRead = resolve;
					});
				if (failRead) throw new Error("decode failed");
				return {
					timestampMs,
					decodedTimestampMs: null,
					detection: {
						landmarks: [],
						worldLandmarks: [],
						imageSize: { width: 640, height: 480 },
						inferenceDurationMs: 1,
						model: { variant: "full", source: "bundled", delegate: "CPU" },
					},
				};
			},
		},
	});
	const moduleURL = new URL("./stubs/expo-video.cjs", import.meta.url).href;
	const hooks = nodeModule.registerHooks({
		resolve(specifier, context, next) {
			if (specifier === "expo") return { url: moduleURL, shortCircuit: true };
			return next(specifier, context);
		},
	});
	try {
		const { analyzePoseVideo } = await import("../src/native/videoAnalysis");
		const progress: number[] = [];
		const stream = analyzePoseVideo("/video.mp4", {
			samplingFps: 2,
			onProgress: (value) => progress.push(value.completedFrames),
		});
		assert.deepEqual(calls, []);
		assert.equal((await stream.next()).value?.timestampMs, 0);
		assert.deepEqual(calls, ["open", 0]);
		await new Promise((resolve) => setTimeout(resolve, 5));
		assert.deepEqual(calls, ["open", 0]);
		assert.equal((await stream.next()).value?.timestampMs, 500);
		assert.equal((await stream.next()).done, true);
		assert.deepEqual(calls, ["open", 0, 500, "close"]);
		assert.deepEqual(progress, [1, 2]);

		calls.length = 0;
		for await (const _frame of analyzePoseVideo("/video.mp4")) break;
		assert.deepEqual(calls, ["open", 0, "close"]);
		calls.length = 0;
		await assert.rejects(
			analyzePoseVideo("/video.mp4", { maxFrames: 1 }).next(),
			/maxFrames/,
		);
		assert.deepEqual(calls, ["open", "close"]);
		failRead = true;
		await assert.rejects(
			analyzePoseVideo("/video.mp4").next(),
			/decode failed/,
		);
		assert.equal(opened, false);
		failRead = false;
		await assert.rejects(
			analyzePoseVideo("/video.mp4", {
				onProgress() {
					throw new Error("progress failed");
				},
			}).next(),
			/progress failed/,
		);
		assert.equal(opened, false);

		const pausedAbort = new AbortController();
		const paused = analyzePoseVideo("/video.mp4", {
			signal: pausedAbort.signal,
		});
		await paused.next();
		pausedAbort.abort();
		await Promise.resolve();
		assert.equal(
			opened,
			false,
			"Abort closes even while consumer is paused at yield",
		);
		await assert.rejects(paused.next(), { name: "AbortError" });
		calls.length = 0;
		await assert.rejects(
			analyzePoseVideo("/video.mp4", { signal: pausedAbort.signal }).next(),
			{ name: "AbortError" },
		);
		assert.deepEqual(calls, []);

		blockRead = true;
		const inFlightAbort = new AbortController();
		const inFlight = analyzePoseVideo("/video.mp4", {
			signal: inFlightAbort.signal,
		});
		const pending = inFlight.next();
		await new Promise((resolve) => setTimeout(resolve, 5));
		inFlightAbort.abort();
		assert.ok(releaseRead);
		releaseRead();
		await assert.rejects(pending, { name: "AbortError" });
		assert.equal(opened, false);
	} finally {
		hooks.deregister();
		Reflect.deleteProperty(globalThis, mockKey);
	}
});

test("video detections record and replay without inventing camera metadata", async (context) => {
	const {
		createPoseDetectionRecorder,
		createPoseDetectionReplay,
		parsePoseDetectionRecording,
		serializePoseDetectionRecording,
	} = await import("../src/core");
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	context.mock.method(performance, "now", () => now);
	const recorder = createPoseDetectionRecorder({ maxFrames: 2 });
	const detection = {
		landmarks: [{ x: 0.5, y: 0.5, z: 0 }],
		worldLandmarks: [],
		imageSize: { width: 640, height: 480 },
		inferenceDurationMs: 1,
		model: {
			variant: "full" as const,
			source: "bundled" as const,
			delegate: "CPU" as const,
		},
	};
	recorder.start();
	recorder.append(detection, 200);
	const originalNose = detection.landmarks[0];
	assert.ok(originalNose);
	originalNose.x = 0.1;
	recorder.append(detection, 700);
	assert.equal(recorder.status, "full");
	const recording = parsePoseDetectionRecording(
		serializePoseDetectionRecording(recorder.stop()),
	);
	assert.deepEqual(
		recording.frames.map((frame) => frame.timestampMs),
		[0, 500],
	);
	const received: number[] = [];
	const replay = createPoseDetectionReplay(recording, {
		onFrame(frame) {
			assert.equal("additionalData" in frame, false);
			const nose = frame.landmarks[0];
			assert.ok(nose);
			received.push(nose.x);
		},
	});
	replay.play();
	context.mock.timers.tick(0);
	now = 500;
	context.mock.timers.tick(500);
	assert.deepEqual(received, [0.5, 0.1]);
	assert.equal(replay.state.status, "ended");
	replay.dispose();
});
