import { strict as assert } from "node:assert";
import { it } from "node:test";
import {
	composeSkeletonFeedback,
	createThresholdRule,
	evaluatePoseRule,
	evaluatePoseThreshold,
	type SkeletonOptions,
} from "../src/core";
import { poseFrame } from "./fixtures";

it("uses distinct enter/exit boundaries and retains unknown inside the initial band", () => {
	const below = {
		direction: "below",
		enterThreshold: 85,
		exitThreshold: 95,
	} as const;
	assert.equal(evaluatePoseThreshold(90, "unknown", below), "unknown");
	assert.equal(evaluatePoseThreshold(85, "unknown", below), true);
	assert.equal(evaluatePoseThreshold(94, "pass", below), true);
	assert.equal(evaluatePoseThreshold(95, "pass", below), false);
	assert.equal(evaluatePoseThreshold(86, "fail", below), false);
	assert.equal(evaluatePoseThreshold(85, "fail", below), true);
	const above = {
		direction: "above",
		enterThreshold: 10,
		exitThreshold: 5,
	} as const;
	assert.equal(evaluatePoseThreshold(7, "unknown", above), "unknown");
	assert.equal(evaluatePoseThreshold(10, "fail", above), true);
	assert.equal(evaluatePoseThreshold(6, "pass", above), true);
	assert.equal(evaluatePoseThreshold(5, "pass", above), false);
	for (const value of [null, NaN, Infinity])
		assert.equal(evaluatePoseThreshold(value, "pass", above), "unknown");
	assert.throws(
		() => evaluatePoseThreshold(10, "pass", { ...above, exitThreshold: 10 }),
		RangeError,
	);
});

it("builds stateless typed threshold rules with configuration reset keys", () => {
	const options = {
		landmarks: ["leftWrist"] as const,
		direction: "above" as const,
		enterThreshold: 0.6,
		exitThreshold: 0.4,
		measure: (pose: { leftWrist: { y: number } }) => pose.leftWrist.y,
	};
	const rule = createThresholdRule(options);
	assert.throws(
		() => createThresholdRule({ ...options, resetKey: NaN }),
		RangeError,
	);
	assert.equal(evaluatePoseRule(poseFrame(), rule), "unknown");
	assert.equal(evaluatePoseRule(poseFrame(), rule, "pass"), "pass");
	assert.equal(evaluatePoseRule(poseFrame(), rule, "fail"), "fail");
	assert.notEqual(
		createThresholdRule({ ...options, enterThreshold: 0.7 }).resetKey,
		rule.resetKey,
	);
	assert.equal(
		createThresholdRule({ ...options, measure: () => 1 }).resetKey,
		rule.resetKey,
	);
});

it("composes rule feedback in order while preserving unrelated attributes and input", () => {
	const base: SkeletonOptions = {
		color: "gray",
		bodyParts: ["leftArm"],
		joints: { leftWrist: { radius: 8, color: "white" } },
		connections: { "leftElbow:leftWrist": { width: 4, color: "gray" } },
	};
	const before = structuredClone(base);
	const result = composeSkeletonFeedback(base, [
		{
			status: "pass",
			styles: {
				pass: {
					joints: { leftWrist: { color: "green" } },
					connections: { "leftElbow:leftWrist": { color: "green" } },
				},
			},
		},
		{
			status: "fail",
			styles: {
				fail: {
					joints: { leftWrist: { color: "red" } },
					connections: { "leftElbow:leftWrist": { color: "red" } },
				},
			},
		},
		{ status: "unknown", styles: { pass: { color: "yellow" } } },
	]);
	assert.deepEqual(result.joints?.leftWrist, { radius: 8, color: "red" });
	assert.deepEqual(result.connections?.["leftElbow:leftWrist"], {
		width: 4,
		color: "red",
	});
	assert.equal(result.color, "gray");
	assert.deepEqual(result.bodyParts, ["leftArm"]);
	assert.deepEqual(base, before);
});
