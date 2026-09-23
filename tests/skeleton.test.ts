import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	createSkeleton,
	getLandmark,
	getNamedLandmarks,
	projectLandmark,
} from "../src/core";
import { poseFrame } from "./fixtures";

describe("Pose presentation", () => {
	it("rejects invalid visibility thresholds before rendering", () => {
		for (const minVisibility of [NaN, Infinity, -0.1, 1.1]) {
			assert.throws(
				() =>
					createSkeleton(
						poseFrame(),
						{ width: 360, height: 640 },
						{ minVisibility },
					),
				RangeError,
			);
		}
	});
	it("exposes anatomical landmark names without changing raw results", () => {
		const frame = poseFrame();
		assert.equal(getLandmark(frame, "leftWrist"), frame.landmarks[15]);
		assert.equal(getNamedLandmarks(frame).rightAnkle, frame.landmarks[28]);
		frame.landmarks.length = 0;
		assert.equal(getLandmark(frame, "leftWrist"), undefined);
		assert.deepEqual(getNamedLandmarks(frame), {});
	});
	it("centers the image and accounts for aspect-fill cropping", () => {
		const image = { width: 1920, height: 1080 };
		const view = { width: 400, height: 400 };
		assert.deepEqual(projectLandmark({ x: 0.5, y: 0.5, z: 0 }, image, view), {
			x: 200,
			y: 200,
		});
		const topLeft = projectLandmark({ x: 0, y: 0, z: 0 }, image, view);
		assert.ok(topLeft.x < 0);
		assert.equal(topLeft.y, 0);
		assert.throws(
			() =>
				projectLandmark({ x: 0, y: 0, z: 0 }, image, { width: 0, height: 10 }),
			RangeError,
		);
	});
	it("does not mirror the native coordinates twice", () => {
		const frame = poseFrame();
		frame.landmarks[15] = { x: 0.2, y: 0.4, z: 0, visibility: 1 };
		const skeleton = createSkeleton(
			frame,
			{ width: 360, height: 640 },
			{ landmarks: ["leftWrist"] },
		);
		assert.equal(skeleton.points[0]?.x, 72);
	});
	it("selects body parts, deduplicates shared joints, and keeps raw detections", () => {
		const frame = poseFrame();
		const before = structuredClone(frame);
		const skeleton = createSkeleton(
			frame,
			{ width: 360, height: 640 },
			{ bodyParts: ["leftArm", "leftWrist"] },
		);
		assert.equal(skeleton.points.length, 6);
		assert.equal(skeleton.lines.length, 6);
		assert.deepEqual(frame, before);
		assert.deepEqual(
			createSkeleton(frame, { width: 360, height: 640 }, { bodyParts: [] }),
			{ points: [], lines: [] },
		);
	});
	it("applies explicit styles over global defaults and removes low-confidence connections", () => {
		const frame = poseFrame();
		const options = {
			bodyParts: ["leftArm"] as const,
			color: "blue",
			jointRadius: 6,
			joints: { leftWrist: { color: "red", radius: 8 } },
			connections: { "leftElbow:leftWrist": { color: "yellow", width: 7 } },
		};
		const skeleton = createSkeleton(
			frame,
			{ width: 360, height: 640 },
			options,
		);
		assert.equal(
			skeleton.points.find((point) => point.name === "leftWrist")?.color,
			"red",
		);
		assert.equal(
			skeleton.points.find((point) => point.name === "leftShoulder")?.radius,
			6,
		);
		assert.equal(
			skeleton.lines.find((line) => line.name === "leftElbow:leftWrist")?.width,
			7,
		);
		frame.landmarks[13] = { x: 0.5, y: 0.5, z: 0, visibility: 0.1 };
		assert.equal(
			createSkeleton(frame, { width: 360, height: 640 }, options).lines.length,
			0,
		);
		frame.landmarks.length = 0;
		assert.equal(
			createSkeleton(frame, { width: 360, height: 640 }).points.length,
			0,
		);
	});
});
