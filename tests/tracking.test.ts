import { strict as assert } from "node:assert";
import { it } from "node:test";
import { inspectPoseTracking } from "../src/core";
import { poseFrame } from "./fixtures";

it("distinguishes no pose, absent joints, uncertain joints and complete tracking", () => {
	const frame = poseFrame();
	const options = { landmarks: ["leftWrist", "rightWrist"] as const };
	assert.equal(inspectPoseTracking(frame, options).status, "found");
	assert.equal(
		inspectPoseTracking({ ...frame, landmarks: [] }, options).status,
		"lost",
	);
	assert.deepEqual(
		inspectPoseTracking(
			{ ...frame, landmarks: frame.landmarks.slice(0, 16) },
			options,
		).missingLandmarks,
		["rightWrist"],
	);
	frame.landmarks[15] = { x: 0, y: 0, z: 0 };
	frame.landmarks[16] = { x: 0, y: 0, z: 0, visibility: 0.9, presence: 0.2 };
	assert.deepEqual(inspectPoseTracking(frame, options), {
		status: "incomplete",
		missingLandmarks: [],
		uncertainLandmarks: ["leftWrist", "rightWrist"],
		outsideImageLandmarks: [],
	});
	assert.equal(
		inspectPoseTracking(frame, { ...options, isActive: false }).status,
		"inactive",
	);
	assert.throws(
		() => inspectPoseTracking(frame, { landmarks: [] }),
		RangeError,
	);
});

it("reports confident out-of-frame joints without modifying their coordinates", () => {
	const frame = poseFrame();
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
