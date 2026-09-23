import assert from "node:assert/strict";
import { test } from "node:test";
import { Schema } from "effect";
import {
	createPoseRecorder,
	createPoseReplay,
	createSkeleton,
	evaluatePoseRule,
	inspectPoseTracking,
	MaxPoses,
	PoseFrame,
	resolvePoseImageOptions,
	selectPose,
} from "../src/core";
import { poseFrame } from "./fixtures";

function multiplePoses(): PoseFrame {
	const first = poseFrame();
	const second = poseFrame();
	const secondNose = second.landmarks[0];
	assert.ok(secondNose);
	secondNose.x = 0.25;
	second.worldLandmarks.push({ x: 1, y: 2, z: 3 });
	return {
		...first,
		additionalData: { ...first.additionalData, poseCount: 2 },
		poses: [
			{ landmarks: first.landmarks, worldLandmarks: first.worldLandmarks },
			{ landmarks: second.landmarks, worldLandmarks: second.worldLandmarks },
		],
	};
}
test("pose-count contracts enforce bounded requests and results", () => {
	assert.equal(resolvePoseImageOptions().maxPoses, 1);
	for (const value of [0, 7, 1.5, NaN])
		assert.throws(() => Schema.decodeUnknownSync(MaxPoses)(value));
	const frame = multiplePoses();
	assert.equal(Schema.decodeUnknownSync(PoseFrame)(frame).poses?.length, 2);
	assert.throws(() =>
		Schema.decodeUnknownSync(PoseFrame)({
			...frame,
			poses: Array(7).fill(frame.poses?.[0]),
		}),
	);
	assert.throws(() =>
		Schema.decodeUnknownSync(PoseFrame)({
			...frame,
			poses: [
				{ landmarks: Array(34).fill(frame.landmarks[0]), worldLandmarks: [] },
			],
		}),
	);
});
test("selection preserves raw results and makes missing poses explicitly empty", () => {
	const frame = multiplePoses();
	const second = selectPose(frame, 1);
	assert.equal(second.landmarks[0]?.x, 0.25);
	assert.deepEqual(second.worldLandmarks, [{ x: 1, y: 2, z: 3 }]);
	assert.equal(frame.landmarks[0]?.x, 0.5);
	assert.equal(
		second.additionalData.poseCount,
		2,
		"Metadata still describes the original detection",
	);
	assert.equal(selectPose(second, 0).landmarks[0]?.x, 0.5);
	const absent = selectPose(frame, 2);
	assert.deepEqual(absent.landmarks, []);
	assert.deepEqual(absent.worldLandmarks, []);
	const legacy = poseFrame();
	assert.equal(selectPose(legacy, 0), legacy);
	assert.deepEqual(selectPose(legacy, 1).landmarks, []);
	for (const index of [-1, 6, 0.5, NaN])
		assert.throws(() => selectPose(frame, index));
});
test("rules, tracking and overlays evaluate the explicit pose selection", () => {
	const frame = multiplePoses();
	const options = {
		landmarks: ["nose"] as const,
		evaluate: (pose: { nose: { x: number } }) => pose.nose.x < 0.4,
	};
	assert.equal(evaluatePoseRule(selectPose(frame, 1), options), "pass");
	assert.equal(evaluatePoseRule(frame, options), "fail");
	assert.equal(evaluatePoseRule(selectPose(frame, 2), options), "unknown");
	assert.equal(
		inspectPoseTracking(selectPose(frame, 2), options).status,
		"lost",
	);
	const skeleton = createSkeleton(
		frame,
		{ width: 720, height: 1280 },
		{ poseIndex: 1 },
	);
	assert.equal(skeleton.points[0]?.x, 180);
	assert.equal(
		createSkeleton(frame, { width: 720, height: 1280 }, { poseIndex: 2 }).points
			.length,
		0,
	);
});
test("recording and replay retain all poses without callback mutation leaking into later playback", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	const recorder = createPoseRecorder();
	recorder.start();
	recorder.append(multiplePoses(), 0);
	const recording = recorder.stop();
	assert.equal(recording.frames[0]?.frame.poses?.length, 2);
	const seen: number[] = [];
	const replay = createPoseReplay(recording, {
		onFrame(frame) {
			const nose = frame.poses?.[1]?.landmarks[0];
			assert.ok(nose);
			seen.push(nose.x);
			nose.x = 0.99;
		},
	});
	replay.play();
	context.mock.timers.tick(0);
	replay.reset();
	replay.play();
	context.mock.timers.tick(0);
	assert.deepEqual(seen, [0.25, 0.25]);
	replay.dispose();
});
