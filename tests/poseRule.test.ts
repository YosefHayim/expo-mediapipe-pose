import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
	advancePoseRule,
	evaluatePoseRule,
	initialPoseRuleState,
	type PoseRuleOptions,
	validatePoseRuleOptions,
} from "../src/core";
import { poseFrame } from "./fixtures";

const raisedWrist: PoseRuleOptions<"leftWrist" | "leftShoulder"> = {
	landmarks: ["leftWrist", "leftShoulder"],
	evaluate: (pose) => pose.leftWrist.y < pose.leftShoulder.y,
};

describe("Pose feedback rules", () => {
	it("lets the application define pass and fail", () => {
		const frame = poseFrame();
		assert.equal(evaluatePoseRule(frame, raisedWrist), "fail");
		frame.landmarks[15] = { x: 0.5, y: 0.1, z: 0, visibility: 0.9 };
		assert.equal(evaluatePoseRule(frame, raisedWrist), "pass");
	});
	it("does not evaluate missing, uncertain, non-finite or inactive input", () => {
		let evaluations = 0;
		const rule = {
			...raisedWrist,
			evaluate: () => {
				evaluations += 1;
				return true;
			},
		};
		for (const wrist of [
			{ x: 0.5, y: 0.1, z: 0 },
			{ x: 0.5, y: 0.1, z: 0, visibility: 0.1 },
			{ x: 0.5, y: 0.1, z: 0, visibility: 1, presence: 0.1 },
			{ x: NaN, y: 0.1, z: 0, visibility: 1 },
			{ x: 0.5, y: 0.1, z: 0, visibility: NaN },
			{ x: 0.5, y: 0.1, z: 0, visibility: 1, presence: Infinity },
		]) {
			const frame = poseFrame();
			frame.landmarks[15] = wrist;
			assert.equal(evaluatePoseRule(frame, rule), "unknown");
		}
		const emptyFrame = poseFrame();
		emptyFrame.landmarks.length = 0;
		assert.equal(evaluatePoseRule(emptyFrame, rule), "unknown");
		assert.equal(
			evaluatePoseRule(poseFrame(), { ...rule, isActive: false }),
			"unknown",
		);
		assert.equal(evaluations, 0);
	});
	it("requires a sustained condition and resets the hold on flicker", () => {
		let state = advancePoseRule(initialPoseRuleState(), "pass", 0, 250);
		state = advancePoseRule(state, "pass", 200, 250);
		assert.equal(state.status, "unknown");
		state = advancePoseRule(state, "fail", 210, 250);
		state = advancePoseRule(state, "pass", 220, 250);
		state = advancePoseRule(state, "pass", 469, 250);
		assert.equal(state.status, "unknown");
		state = advancePoseRule(state, "pass", 470, 250);
		assert.equal(state.status, "pass");
		assert.equal(advancePoseRule(state, "unknown", 471, 250).status, "unknown");
	});
	it("does not count elapsed time from a previous clock/session", () => {
		const oldState = advancePoseRule(initialPoseRuleState(), "pass", 9000, 250);
		const newState = advancePoseRule(oldState, "pass", 1, 250);
		assert.equal(newState.status, "unknown");
		assert.equal(newState.since, 1);
	});
	it("rejects invalid configuration rather than inventing defaults", () => {
		assert.throws(
			() => validatePoseRuleOptions({ ...raisedWrist, landmarks: [] }),
			RangeError,
		);
		assert.throws(
			() => validatePoseRuleOptions({ ...raisedWrist, minVisibility: 2 }),
			RangeError,
		);
		assert.throws(
			() => validatePoseRuleOptions({ ...raisedWrist, holdMs: -1 }),
			RangeError,
		);
		assert.throws(
			() => validatePoseRuleOptions({ ...raisedWrist, staleAfterMs: 0 }),
			RangeError,
		);
	});
});
