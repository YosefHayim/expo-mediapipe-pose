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

	const isRuleKindHeight = rule.kind === "height";
	if (isRuleKindHeight) {
		const confidence = getImageDistance(frame, rule.start, rule.end, options);

		const isConfidenceUnavailable = confidence.status !== "available";
		if (isConfidenceUnavailable) return { value: null, unit: "px Δy" };

		const start = frame.landmarks[LANDMARK_NAMES.indexOf(rule.start)];
		const end = frame.landmarks[LANDMARK_NAMES.indexOf(rule.end)];
		const hasBothLandmarks = start != null && end != null;
		return {
			value: hasBothLandmarks
				? (start.y - end.y) * frame.imageSize.height
				: null,
			unit: "px Δy",
		};
	}

	let measurement: PoseMeasurement;

	const isRuleKindAngle = rule.kind === "angle";
	const isRuleSpaceImage = rule.space === "image";

	if (isRuleKindAngle) {
		measurement = isRuleSpaceImage
			? getImageJointAngle(frame, rule.start, rule.vertex, rule.end, options)
			: getWorldJointAngle(frame, rule.start, rule.vertex, rule.end, options);
	} else {
		measurement = isRuleSpaceImage
			? getImageDistance(frame, rule.start, rule.end, options)
			: getWorldDistance(frame, rule.start, rule.end, options);
	}

	const jointMeasurement = measurement;

	const isJointMeasurementUnavailable = jointMeasurement.status !== "available";
	if (isJointMeasurementUnavailable)
		return { value: null, unit: "unavailable" };

	return { value: jointMeasurement.value, unit: jointMeasurement.unit };
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

		const isResultPass = result === true;
		if (isResultPass) outcome = "pass";

		const isResultFail = result === false;
		if (isResultFail) outcome = "fail";

		return advancePoseRule(state, outcome, now, rule.holdMs);
	});
}
