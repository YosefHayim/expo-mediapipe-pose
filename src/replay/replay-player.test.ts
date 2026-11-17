import assert from "node:assert/strict";
import { describe, test, vi } from "vitest";
import {
	advancePoseRule,
	createPoseRecorder,
	createPoseReplay,
	evaluatePoseRule,
	initialPoseRuleState,
	type PoseReplay,
	type PoseRuleState,
} from "../core";
import { createPoseFrame } from "../testing/fixtures";

const createRecording = () => {
	const recorder = createPoseRecorder();
	recorder.start();
	for (const [index, timestamp] of [0, 100, 250].entries()) {
		const frame = createPoseFrame();
		recorder.append(
			{
				...frame,
				additionalData: { ...frame.additionalData, frameNumber: index + 1 },
			},
			1000 + timestamp,
		);
	}
	return recorder.stop();
};

describe("createPoseReplay", () => {
	test("replay schedules recorded frames, pauses, changes speed, seeks and disposes", () => {
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		let now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => now);
		const advance = (ms: number) => {
			now += ms;
			vi.advanceTimersByTime(ms);
		};
		const frames: number[] = [];
		let resets = 0;
		const replay = createPoseReplay(createRecording(), {
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

	test("replay honors controls called inside callbacks and isolates returned frames", () => {
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		let now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => now);
		let replay: PoseReplay;
		const originalHorizontal: number[] = [];
		replay = createPoseReplay(createRecording(), {
			onFrame: (frame) => {
				const nose = frame.landmarks[0];
				assert.ok(nose);
				originalHorizontal.push(nose.x);
				nose.x = 99;
				replay.pause();
			},
		});

		replay.play();
		vi.advanceTimersByTime(0);
		now = 1000;
		vi.advanceTimersByTime(1000);
		assert.equal(originalHorizontal.length, 1);

		replay.reset();
		replay.play();
		vi.advanceTimersByTime(0);
		assert.deepEqual(originalHorizontal, [0.5, 0.5]);

		for (const speed of [0, -1, 5, NaN])
			assert.throws(() => replay.setSpeed(speed));
		for (const position of [-1, 251, Infinity])
			assert.throws(() => replay.seek(position));
		replay.dispose();
	});

	test("callback failures pause and cancel replay instead of leaving a running controller", () => {
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		vi.spyOn(performance, "now").mockImplementation(() => 0);
		const failure = new Error("consumer callback failed");

		const replay = createPoseReplay(createRecording(), {
			onFrame: () => {
				throw failure;
			},
		});
		replay.play();
		assert.throws(() => vi.advanceTimersByTime(0), failure);
		assert.equal(replay.state.status, "paused");
		replay.dispose();

		const resetFailure = createPoseReplay(createRecording(), {
			onFrame: () => {},
			onReset: () => {
				throw failure;
			},
		});
		resetFailure.play();
		assert.throws(() => resetFailure.seek(100), failure);
		assert.equal(resetFailure.state.status, "paused");
		resetFailure.dispose();

		const statusFailure = createPoseReplay(createRecording(), {
			onFrame: () => {},
			onStateChange: () => {
				throw failure;
			},
		});
		assert.throws(() => statusFailure.play(), failure);
		assert.equal(statusFailure.state.status, "paused");
		statusFailure.dispose();
	});

	test("state callbacks can pause playback without rescheduling or recursive notifications", () => {
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		vi.spyOn(performance, "now").mockImplementation(() => 0);
		let replay: PoseReplay;
		let delivered = 0;
		replay = createPoseReplay(createRecording(), {
			onFrame: () => delivered++,
			onStateChange: () => {
				replay.pause();
				replay.setSpeed(1);
			},
		});

		replay.play();
		vi.advanceTimersByTime(1000);
		assert.equal(delivered, 0);
		assert.equal(replay.state.status, "paused");
		replay.dispose();
	});
});

describe("advancePoseRule", () => {
	test("recorded relative time feeds deterministic pure rules without camera initialization", () => {
		vi.useFakeTimers({ toFake: ["setTimeout"] });
		let now = 0;
		vi.spyOn(performance, "now").mockImplementation(() => now);
		let ruleSnapshot: PoseRuleState = initialPoseRuleState();
		const replay = createPoseReplay(createRecording(), {
			onFrame: (frame, timestamp) => {
				ruleSnapshot = advancePoseRule(
					ruleSnapshot,
					evaluatePoseRule(frame, {
						landmarks: ["nose"],
						evaluate: () => true,
					}),
					timestamp,
					200,
				);
			},
		});

		replay.play();
		vi.advanceTimersByTime(0);
		now = 100;
		vi.advanceTimersByTime(100);
		assert.equal(ruleSnapshot.status, "unknown");
		now = 250;
		vi.advanceTimersByTime(150);
		assert.equal(ruleSnapshot.status, "pass");
		assert.equal(replay.state.status, "ended");
	});
});
