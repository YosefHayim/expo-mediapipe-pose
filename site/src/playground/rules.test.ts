import {
	createDetectionSkeleton,
	initialPoseRuleState,
} from "expo-mediapipe-pose/core";
import { describe, expect, test } from "vitest";
import { defaultRule } from "./config";
import { updateRules } from "./rules";
import { createSampleBrowserFrame } from "./sample-frame";

describe("updateRules", () => {
	test("holds the pass status for the hold time and ignores unselected poses", () => {
		const detection = createSampleBrowserFrame();
		const rule = { ...defaultRule, enterThreshold: 95, exitThreshold: 100 };

		const firstStatuses = updateRules({
			frame: detection,
			poseIndex: 0,
			rules: [rule],
			previous: [initialPoseRuleState()],
			now: 100,
		});
		const heldStatuses = updateRules({
			frame: detection,
			poseIndex: 0,
			rules: [rule],
			previous: firstStatuses,
			now: 400,
		});
		const unselectedStatuses = updateRules({
			frame: detection,
			poseIndex: 1,
			rules: [rule],
			previous: heldStatuses,
			now: 500,
		});
		const unselectedSkeleton = createDetectionSkeleton(
			detection,
			{ width: 400, height: 200 },
			{ poseIndex: 1 },
		);

		expect(firstStatuses[0]?.status).toBe("unknown");
		expect(heldStatuses[0]?.status).toBe("pass");
		expect(unselectedStatuses[0]?.status).toBe("unknown");
		expect(unselectedSkeleton.points).toHaveLength(0);
		expect(detection.landmarks).toHaveLength(33);
	});
});
