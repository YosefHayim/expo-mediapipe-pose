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

export const measureRule = (
	frame: BrowserFrame,
	rule: Rule,
): { value: number | null; unit: string } => {
	const settings = { minVisibility: rule.minVisibility };

	const isRuleKindHeight = rule.kind === "height";
	if (isRuleKindHeight) {
		const confidence = getImageDistance(frame, rule.start, rule.end, settings);

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
			? getImageJointAngle(frame, rule.start, rule.vertex, rule.end, settings)
			: getWorldJointAngle(frame, rule.start, rule.vertex, rule.end, settings);
	} else {
		measurement = isRuleSpaceImage
			? getImageDistance(frame, rule.start, rule.end, settings)
			: getWorldDistance(frame, rule.start, rule.end, settings);
	}

	const jointMeasurement = measurement;

	const isJointMeasurementUnavailable = jointMeasurement.status !== "available";
	if (isJointMeasurementUnavailable)
		return { value: null, unit: "unavailable" };

	return { value: jointMeasurement.value, unit: jointMeasurement.unit };
};
export interface UpdateRulesDetails {
	frame: BrowserFrame;
	poseIndex: number;
	rules: readonly Rule[];
	previous: readonly PoseRuleState[];
	now: number;
}

export const updateRules = ({
	frame,
	poseIndex,
	rules,
	previous,
	now,
}: UpdateRulesDetails) => {
	const selected = selectPose(frame, poseIndex);
	return rules.map((rule, index) => {
		const status = previous[index] ?? initialPoseRuleState();
		const measurement = measureRule(selected, rule);
		const report = evaluatePoseThreshold(
			measurement.value,
			status.candidate,
			rule,
		);
		let verdict: "pass" | "fail" | "unknown" = "unknown";

		const isReportPass = report === true;
		if (isReportPass) verdict = "pass";

		const isReportFail = report === false;
		if (isReportFail) verdict = "fail";

		return advancePoseRule(status, verdict, now, rule.holdMs);
	});
};
