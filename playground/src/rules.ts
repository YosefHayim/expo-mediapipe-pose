import {
	advancePoseRule,
	evaluatePoseThreshold,
	getImageDistance,
	getImageJointAngle,
	getWorldDistance,
	getWorldJointAngle,
	initialPoseRuleState,
	LANDMARK_NAMES,
	type PoseMeasurement,
	type PoseRuleState,
	selectPose,
} from "expo-mediapipe-pose/core";
import type { Rule } from "./config";
import type { BrowserFrame } from "./types";

export function measureRule(
	frame: BrowserFrame,
	rule: Rule,
): { value: number | null; unit: string } {
	const options = { minVisibility: rule.minVisibility };
	if (rule.kind === "height") {
		const confidence = getImageDistance(frame, rule.start, rule.end, options);
		if (confidence.status !== "available")
			return { value: null, unit: "px Δy" };
		const start = frame.landmarks[LANDMARK_NAMES.indexOf(rule.start)];
		const end = frame.landmarks[LANDMARK_NAMES.indexOf(rule.end)];
		return {
			value: start && end ? (start.y - end.y) * frame.imageSize.height : null,
			unit: "px Δy",
		};
	}
	let measurement: PoseMeasurement;
	if (rule.kind === "angle") {
		measurement =
			rule.space === "image"
				? getImageJointAngle(frame, rule.start, rule.vertex, rule.end, options)
				: getWorldJointAngle(frame, rule.start, rule.vertex, rule.end, options);
	} else {
		measurement =
			rule.space === "image"
				? getImageDistance(frame, rule.start, rule.end, options)
				: getWorldDistance(frame, rule.start, rule.end, options);
	}
	return {
		value: measurement.status === "available" ? measurement.value : null,
		unit: measurement.status === "available" ? measurement.unit : "unavailable",
	};
}
export function updateRules(
	frame: BrowserFrame,
	poseIndex: number,
	rules: readonly Rule[],
	previous: readonly PoseRuleState[],
	now: number,
) {
	const selected = selectPose(frame, poseIndex);
	return rules.map((rule, index) => {
		const state = previous[index] ?? initialPoseRuleState();
		const measurement = measureRule(selected, rule);
		const result = evaluatePoseThreshold(
			measurement.value,
			state.candidate,
			rule,
		);
		let outcome: "pass" | "fail" | "unknown" = "unknown";
		if (result === true) outcome = "pass";
		if (result === false) outcome = "fail";
		return advancePoseRule(state, outcome, now, rule.holdMs);
	});
}
