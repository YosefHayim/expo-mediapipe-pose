import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
	createDetectionSkeleton,
	getNamedLandmarks,
	PoseDetection,
	resolvePoseImageOptions,
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
			segmentationEnabled: false,
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
