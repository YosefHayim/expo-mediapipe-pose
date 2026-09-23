import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { test } from "node:test";
import { Schema } from "effect";
import {
	createPoseDetectionRecorder,
	createPoseRecorder,
	PoseSegmentation,
	parsePoseRecording,
	resolvePoseImageOptions,
} from "../src/core";
import { poseFrame } from "./fixtures";

const leaseId = "a766dfac-4266-4dac-8de2-e8c9983ce558";
const segmentation = {
	status: "available" as const,
	leaseId,
	imageSize: { width: 1000, height: 667 },
	masks: [
		{ poseIndex: 0, uri: "file:///cache/mask.png", width: 256, height: 170 },
	],
};

test("segmentation is opt-in and validates bounded mask contracts", () => {
	assert.equal(resolvePoseImageOptions().segmentationEnabled, false);
	for (const maskMaxDimension of [0, 63, 513, 255.5, NaN])
		assert.throws(() => resolvePoseImageOptions({ maskMaxDimension }));
	const decode = Schema.decodeUnknownSync(PoseSegmentation);
	assert.deepEqual(decode(segmentation), segmentation);
	assert.deepEqual(decode({ status: "backpressure" }), {
		status: "backpressure",
	});
	assert.throws(() => decode({ ...segmentation, masks: [] }));
	assert.throws(() => decode({ ...segmentation, leaseId: "../../file" }));
	assert.throws(() =>
		decode({
			...segmentation,
			masks: [{ ...segmentation.masks[0], width: 513 }],
		}),
	);
	assert.throws(() =>
		decode({
			...segmentation,
			masks: [{ ...segmentation.masks[0], poseIndex: 1 }],
		}),
	);
	assert.throws(() =>
		decode({
			...segmentation,
			masks: [
				{ ...segmentation.masks[0], uri: "https://example.com/mask.png" },
			],
		}),
	);
});
test("landmark recordings exclude ephemeral mask handles without releasing consumer-owned files", () => {
	const frame = { ...poseFrame(), segmentation };
	const recorder = createPoseRecorder();
	recorder.start();
	recorder.append(frame, 0);
	const recording = recorder.stop();
	const recorded = recording.frames[0];
	assert.ok(recorded);
	assert.equal("segmentation" in recorded.frame, false);
	assert.equal(frame.segmentation.leaseId, leaseId);
	assert.throws(() =>
		parsePoseRecording(
			JSON.stringify({ version: 1, frames: [{ timestampMs: 0, frame }] }),
		),
	);
	const detection = {
		landmarks: frame.landmarks,
		worldLandmarks: frame.worldLandmarks,
		segmentation,
		imageSize: { width: 1000, height: 667 },
		inferenceDurationMs: 1,
		model: {
			variant: "full" as const,
			source: "bundled" as const,
			delegate: "CPU" as const,
		},
	};
	const media = createPoseDetectionRecorder();
	media.start();
	media.append(detection, 0);
	const recordedDetection = media.stop().frames[0];
	assert.ok(recordedDetection);
	assert.equal("segmentation" in recordedDetection.frame, false);
});
test("native mask cleanup validates handles and reclaims malformed or undelivered results", async () => {
	const calls: string[] = [];
	let releaseFailure: Error | undefined;
	let closeFailure: Error | undefined;
	const nativeKey = Symbol.for("pose.nativeVideoTest");
	const response = {
		landmarks: [],
		worldLandmarks: [],
		imageSize: { width: 1000, height: 667 },
		inferenceDurationMs: 1,
		model: { variant: "full", source: "bundled", delegate: "CPU" },
		segmentation,
	};
	Object.defineProperty(globalThis, nativeKey, {
		configurable: true,
		value: {
			async releasePoseSegmentation(id: string) {
				calls.push(id);
				if (releaseFailure) throw releaseFailure;
			},
			async analyzePoseImage() {
				return { ...response, imageSize: { width: -1, height: 1 } };
			},
			async openPoseVideo() {
				return { id: "session", durationMs: 1000 };
			},
			async closePoseVideo() {
				calls.push("close");
				if (closeFailure) throw closeFailure;
			},
			async readPoseVideoFrame() {
				return {
					timestampMs: 0,
					decodedTimestampMs: null,
					detection: response,
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
		const { releasePoseSegmentation, discardResultSegmentation } = await import(
			"../src/native/segmentation"
		);
		await assert.rejects(releasePoseSegmentation("../../file"));
		assert.deepEqual(calls, []);
		await discardResultSegmentation({ segmentation: { leaseId: "invalid" } });
		assert.deepEqual(calls, []);
		const { analyzePoseImage } = await import("../src/native/imageAnalysis");
		await assert.rejects(analyzePoseImage("/photo.jpg"));
		assert.deepEqual(calls, [leaseId]);
		calls.length = 0;
		releaseFailure = new Error("image mask release failed");
		await assert.rejects(analyzePoseImage("/photo.jpg"), (error: unknown) => {
			assert.ok(error instanceof AggregateError);
			assert.equal(error.errors.length, 2);
			assert.equal(error.cause, error.errors[0]);
			assert.notEqual(error.cause, releaseFailure);
			assert.equal(error.errors[1], releaseFailure);
			return true;
		});
		assert.deepEqual(calls, [leaseId]);
		releaseFailure = undefined;
		calls.length = 0;
		const { analyzePoseVideo } = await import("../src/native/videoAnalysis");
		const controller = new AbortController();
		await assert.rejects(
			analyzePoseVideo("/video.mp4", {
				signal: controller.signal,
				onProgress: () => controller.abort(),
			}).next(),
			{ name: "AbortError" },
		);
		assert.deepEqual(calls.toSorted(), [leaseId, "close"].toSorted());
		calls.length = 0;
		const stream = analyzePoseVideo("/video.mp4");
		await stream.next();
		await stream.return();
		assert.deepEqual(
			calls,
			["close"],
			"A yielded mask remains owned by its consumer",
		);
		await releasePoseSegmentation(leaseId);
		assert.deepEqual(calls, ["close", leaseId]);
		calls.length = 0;
		const progressFailure = new Error("progress failed");
		releaseFailure = new Error("mask release failed");
		closeFailure = new Error("video close failed");
		await assert.rejects(
			analyzePoseVideo("/video.mp4", {
				onProgress() {
					throw progressFailure;
				},
			}).next(),
			(error: unknown) => {
				assert.ok(error instanceof AggregateError);
				assert.equal(error.cause, progressFailure);
				assert.deepEqual(error.errors, [
					progressFailure,
					releaseFailure,
					closeFailure,
				]);
				return true;
			},
		);
		assert.deepEqual(
			calls,
			[leaseId, "close"],
			"Video closes even if mask cleanup fails",
		);
	} finally {
		hooks.deregister();
		Reflect.deleteProperty(globalThis, nativeKey);
	}
});
