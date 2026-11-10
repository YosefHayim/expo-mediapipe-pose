import { strict as assert } from "node:assert";
import { describe, test } from "vitest";
import { inspectPoseTracking } from "../core";
import { createPoseFrame } from "../testing/fixtures";

describe("inspectPoseTracking", () => {
	test("distinguishes no pose, absent joints, uncertain joints and complete tracking", () => {
		const frame = createPoseFrame();
		const settings = { landmarks: ["leftWrist", "rightWrist"] as const };

		assert.equal(inspectPoseTracking(frame, settings).status, "found");
		assert.equal(
			inspectPoseTracking({ ...frame, landmarks: [] }, settings).status,
			"lost",
		);
		assert.deepEqual(
			inspectPoseTracking(
				{ ...frame, landmarks: frame.landmarks.slice(0, 16) },
				settings,
			).missingLandmarks,
			["rightWrist"],
		);

		frame.landmarks[15] = { x: 0, y: 0, z: 0 };
		frame.landmarks[16] = { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.2 };
		assert.deepEqual(inspectPoseTracking(frame, settings), {
			status: "incomplete",
			missingLandmarks: [],
			uncertainLandmarks: ["leftWrist", "rightWrist"],
			outsideImageLandmarks: [],
		});
		assert.equal(
			inspectPoseTracking(frame, { ...settings, isActive: false }).status,
			"inactive",
		);
		assert.throws(
			() => inspectPoseTracking(frame, { landmarks: [] }),
			RangeError,
		);
	});

	test("reports confident out-of-frame joints without modifying their coordinates", () => {
		const frame = createPoseFrame();
		frame.landmarks[15] = { x: -0.1, y: 0.5, z: 0, visibility: 0.9 };

		assert.deepEqual(
			inspectPoseTracking(frame, { landmarks: ["leftWrist", "leftWrist"] }),
			{
				status: "incomplete",
				missingLandmarks: [],
				uncertainLandmarks: [],
				outsideImageLandmarks: ["leftWrist"],
			},
		);
		assert.equal(frame.landmarks[15].x, -0.1);

		frame.landmarks[15].x = 0;
		assert.equal(
			inspectPoseTracking(frame, { landmarks: ["leftWrist"] }).status,
			"found",
		);
	});
});
