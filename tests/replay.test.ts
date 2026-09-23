import assert from "node:assert/strict";
import { test } from "node:test";
import {
	advancePoseRule,
	createPoseRecorder,
	createPoseReplay,
	evaluatePoseRule,
	initialPoseRuleState,
	type PoseReplay,
	type PoseRuleState,
} from "../src/core";
import { poseFrame } from "./fixtures";

function recording() {
	const recorder = createPoseRecorder();
	recorder.start();
	for (const [index, timestamp] of [0, 100, 250].entries()) {
		const frame = poseFrame();
		recorder.append(
			{
				...frame,
				additionalData: { ...frame.additionalData, frameNumber: index + 1 },
			},
			1000 + timestamp,
		);
	}
	return recorder.stop();
}
test("replay schedules recorded frames, pauses, changes speed, seeks and disposes", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	context.mock.method(performance, "now", () => now);
	const advance = (ms: number) => {
		now += ms;
		context.mock.timers.tick(ms);
	};
	const frames: number[] = [];
	let resets = 0;
	const replay = createPoseReplay(recording(), {
		onFrame: (_frame, timestamp) => frames.push(timestamp),
		onReset: () => resets++,
	});
	replay.play();
	advance(0);
	assert.deepEqual(frames, [0]);
	advance(40);
	replay.pause();
	advance(500);
	assert.equal(replay.state.positionMs, 40);
	replay.setSpeed(2);
	replay.play();
	advance(29);
	assert.deepEqual(frames, [0]);
	advance(1);
	assert.deepEqual(frames, [0, 100]);
	replay.seek(200);
	advance(24);
	assert.equal(frames.length, 2);
	advance(1);
	assert.deepEqual(frames, [0, 100, 250]);
	assert.equal(replay.state.status, "ended");
	replay.play();
	advance(100);
	assert.equal(frames.length, 3);
	replay.reset();
	assert.equal(resets, 2);
	replay.play();
	advance(0);
	assert.equal(frames.length, 4);
	replay.dispose();
	advance(1000);
	assert.equal(frames.length, 4);
	assert.throws(() => replay.play());
});
test("replay honors controls called inside callbacks and isolates returned frames", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	context.mock.method(performance, "now", () => now);
	let replay: PoseReplay;
	const originalX: number[] = [];
	replay = createPoseReplay(recording(), {
		onFrame: (frame) => {
			const nose = frame.landmarks[0];
			assert.ok(nose);
			originalX.push(nose.x);
			nose.x = 99;
			replay.pause();
		},
	});
	replay.play();
	context.mock.timers.tick(0);
	now = 1000;
	context.mock.timers.tick(1000);
	assert.equal(originalX.length, 1);
	replay.reset();
	replay.play();
	context.mock.timers.tick(0);
	assert.deepEqual(originalX, [0.5, 0.5]);
	for (const speed of [0, -1, 5, NaN])
		assert.throws(() => replay.setSpeed(speed));
	for (const position of [-1, 251, Infinity])
		assert.throws(() => replay.seek(position));
	replay.dispose();
});
test("recorded relative time feeds deterministic pure rules without camera initialization", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	let now = 0;
	context.mock.method(performance, "now", () => now);
	let state: PoseRuleState = initialPoseRuleState();
	const replay = createPoseReplay(recording(), {
		onFrame: (frame, timestamp) => {
			state = advancePoseRule(
				state,
				evaluatePoseRule(frame, { landmarks: ["nose"], evaluate: () => true }),
				timestamp,
				200,
			);
		},
	});
	replay.play();
	context.mock.timers.tick(0);
	now = 100;
	context.mock.timers.tick(100);
	assert.equal(state.status, "unknown");
	now = 250;
	context.mock.timers.tick(150);
	assert.equal(state.status, "pass");
	assert.equal(replay.state.status, "ended");
});

test("callback failures pause and cancel replay instead of leaving a running controller", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	context.mock.method(performance, "now", () => 0);
	const failure = new Error("consumer callback failed");
	const replay = createPoseReplay(recording(), {
		onFrame: () => {
			throw failure;
		},
	});
	replay.play();
	assert.throws(() => context.mock.timers.tick(0), failure);
	assert.equal(replay.state.status, "paused");
	replay.dispose();
	const resetFailure = createPoseReplay(recording(), {
		onFrame: () => {},
		onReset: () => {
			throw failure;
		},
	});
	resetFailure.play();
	assert.throws(() => resetFailure.seek(100), failure);
	assert.equal(resetFailure.state.status, "paused");
	resetFailure.dispose();
	const stateFailure = createPoseReplay(recording(), {
		onFrame: () => {},
		onStateChange: () => {
			throw failure;
		},
	});
	assert.throws(() => stateFailure.play(), failure);
	assert.equal(stateFailure.state.status, "paused");
	stateFailure.dispose();
});

test("state callbacks can pause playback without rescheduling or recursive notifications", (context) => {
	context.mock.timers.enable({ apis: ["setTimeout"] });
	context.mock.method(performance, "now", () => 0);
	let replay: PoseReplay;
	let delivered = 0;
	replay = createPoseReplay(recording(), {
		onFrame: () => delivered++,
		onStateChange: () => {
			replay.pause();
			replay.setSpeed(1);
		},
	});
	replay.play();
	context.mock.timers.tick(1000);
	assert.equal(delivered, 0);
	assert.equal(replay.state.status, "paused");
	replay.dispose();
});
