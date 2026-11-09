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

		const firstStates = updateRules(
			detection,
			0,
			[rule],
			[initialPoseRuleState()],
			100,
		);
		const heldStates = updateRules(detection, 0, [rule], firstStates, 400);
		const unselectedStates = updateRules(detection, 1, [rule], heldStates, 500);
		const unselectedSkeleton = createDetectionSkeleton(
			detection,
			{ width: 400, height: 200 },
			{ poseIndex: 1 },
		);

		expect(firstStates[0]?.status).toBe("unknown");
		expect(heldStates[0]?.status).toBe("pass");
		expect(unselectedStates[0]?.status).toBe("unknown");
		expect(unselectedSkeleton.points).toHaveLength(0);
		expect(detection.landmarks).toHaveLength(33);
	});
});
