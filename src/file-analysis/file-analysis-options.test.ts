import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
	createDetectionSkeleton,
	createVideoSamplePlan,
	getNamedLandmarks,
	PoseDetection,
	resolvePoseImageOptions,
	resolvePoseVideoOptions,
	validateLocalFileLocation,
} from "../core";
import { createPoseFrame } from "../testing/fixtures";

describe("validateLocalFileLocation", () => {
	test("photo analysis validates local inputs", () => {
		for (const location of [
			"/cache/image.jpg",
			"file:///cache/image%20one.jpg",
		])
			assert.doesNotThrow(() => validateLocalFileLocation(location));

		for (const location of [
			"https://example.com/image.jpg",
			"content://media/image",
			"relative.jpg",
			"file://server/image.jpg",
			"file:///image.jpg?query=1",
			"file:///image.jpg#fragment",
			"/cache/\0.jpg",
		])
			assert.throws(() => validateLocalFileLocation(location));
	});
});

describe("resolvePoseImageOptions", () => {
	test("photo analysis bounds model options", () => {
		assert.deepEqual(resolvePoseImageOptions(), {
			modelVariant: "full",
			maxPoses: 1,
			personMaskEnabled: false,
			maskMaxDimension: 256,
			maxImageDimension: 2048,
			minPoseDetectionConfidence: 0.35,
			minPosePresenceConfidence: 0.35,
		});

		assert.throws(() => resolvePoseImageOptions({ modelVariant: "lite" }));
		assert.equal(
			resolvePoseImageOptions({
				modelVariant: "lite",
				modelPath: "/cache/lite.task",
			}).modelVariant,
			"lite",
		);

		for (const maxImageDimension of [0, 255, 2049, NaN])
			assert.throws(() => resolvePoseImageOptions({ maxImageDimension }));
		assert.throws(() =>
			resolvePoseImageOptions({ minPoseDetectionConfidence: 2 }),
		);
	});
});

describe("PoseDetection", () => {
	test("media detections support geometry and skeletons without camera metadata", () => {
		const { landmarks, worldLandmarks, additionalData } = createPoseFrame();
		const detection = PoseDetection.parse({
			additionalData,
			landmarks,
			worldLandmarks,
			imageSize: { width: 720, height: 1280 },
			inferenceDurationMs: 10,
			model: { variant: "full", source: "bundled", delegate: "CPU" },
		});

		assert.equal(getNamedLandmarks(detection).nose?.x, 0.5);
		assert.equal(
			createDetectionSkeleton(detection, { width: 720, height: 1280 }).points
				.length,
			33,
		);
		assert.equal("additionalData" in detection, false);
	});
});

describe("createVideoSamplePlan", () => {
	test("video sampling is bounded, monotonic and excludes the range end", () => {
		const plan = createVideoSamplePlan(1000, { samplingFps: 30 });
		const times = Array.from({ length: plan.frameCount }, (_, index) =>
			plan.timestampMsAt(index),
		);
		assert.equal(times.length, 30);
		assert.deepEqual(times.slice(0, 4), [0, 33, 66, 100]);
		assert.equal(times.at(-1), 966);
		assert.equal(new Set(times).size, 30);
		assert.throws(() => plan.timestampMsAt(-1));
		assert.throws(() => plan.timestampMsAt(30));
		const ranged = createVideoSamplePlan(5000, {
			startMs: 200,
			endMs: 1201,
			samplingFps: 2,
		});
		assert.deepEqual(
			Array.from({ length: ranged.frameCount }, (_, i) =>
				ranged.timestampMsAt(i),
			),
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
});
