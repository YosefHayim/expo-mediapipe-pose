import { strict as assert } from "node:assert";
import { describe, test } from "vitest";
import {
	composeSkeletonFeedback,
	createThresholdRule,
	evaluatePoseRule,
	evaluatePoseThreshold,
	type SkeletonOptions,
} from "../core";
import { createPoseFrame } from "../testing/fixtures";

describe("evaluatePoseThreshold", () => {
	test("uses distinct enter/exit boundaries and retains unknown inside the initial band", () => {
		const below = {
			direction: "below",
			enterThreshold: 85,
			exitThreshold: 95,
		} as const;
		const above = {
			direction: "above",
			enterThreshold: 10,
			exitThreshold: 5,
		} as const;

		assert.equal(evaluatePoseThreshold(90, "unknown", below), "unknown");
		assert.equal(evaluatePoseThreshold(85, "unknown", below), true);
		assert.equal(evaluatePoseThreshold(94, "pass", below), true);
		assert.equal(evaluatePoseThreshold(95, "pass", below), false);
		assert.equal(evaluatePoseThreshold(86, "fail", below), false);
		assert.equal(evaluatePoseThreshold(85, "fail", below), true);
		assert.equal(evaluatePoseThreshold(7, "unknown", above), "unknown");
		assert.equal(evaluatePoseThreshold(10, "fail", above), true);
		assert.equal(evaluatePoseThreshold(6, "pass", above), true);
		assert.equal(evaluatePoseThreshold(5, "pass", above), false);

		for (const amount of [null, NaN, Infinity])
			assert.equal(evaluatePoseThreshold(amount, "pass", above), "unknown");
		assert.throws(
			() => evaluatePoseThreshold(10, "pass", { ...above, exitThreshold: 10 }),
			RangeError,
		);
	});
});

describe("createThresholdRule", () => {
	test("builds stateless typed threshold rules with configuration reset keys", () => {
		const settings = {
			landmarks: ["leftWrist"] as const,
			direction: "above" as const,
			enterThreshold: 0.6,
			exitThreshold: 0.4,
			measure: (pose: { leftWrist: { y: number } }) => pose.leftWrist.y,
		};
		const rule = createThresholdRule(settings);

		assert.throws(
			() => createThresholdRule({ ...settings, resetKey: NaN }),
			RangeError,
		);
		assert.equal(evaluatePoseRule(createPoseFrame(), rule), "unknown");
		assert.equal(evaluatePoseRule(createPoseFrame(), rule, "pass"), "pass");
		assert.equal(evaluatePoseRule(createPoseFrame(), rule, "fail"), "fail");
		assert.notEqual(
			createThresholdRule({ ...settings, enterThreshold: 0.7 }).resetKey,
			rule.resetKey,
		);
		assert.equal(
			createThresholdRule({ ...settings, measure: () => 1 }).resetKey,
			rule.resetKey,
		);
	});
});

describe("composeSkeletonFeedback", () => {
	test("composes rule feedback in order while preserving unrelated attributes and input", () => {
		const base: SkeletonOptions = {
			color: "gray",
			bodyParts: ["leftArm"],
			joints: { leftWrist: { radius: 8, color: "white" } },
			connections: { "leftElbow:leftWrist": { width: 4, color: "gray" } },
		};
		const before = structuredClone(base);

		const report = composeSkeletonFeedback(base, [
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

		assert.deepEqual(report.joints?.leftWrist, { radius: 8, color: "red" });
		assert.deepEqual(report.connections?.["leftElbow:leftWrist"], {
			width: 4,
			color: "red",
		});
		assert.equal(report.color, "gray");
		assert.deepEqual(report.bodyParts, ["leftArm"]);
		assert.deepEqual(base, before);
	});
});
