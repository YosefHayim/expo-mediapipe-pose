import type { Landmark, PoseFrame } from "../contracts";
import type { LandmarkName } from "./landmarks";
import {
	type PoseRuleOptions,
	type PoseRuleStatus,
	validatePoseRuleOptions,
} from "./poseRule";

export interface PoseThreshold {
	direction: "above" | "below";
	enterThreshold: number;
	exitThreshold: number;
}
const validateThreshold = (threshold: PoseThreshold) => {
	const { direction, enterThreshold, exitThreshold } = threshold;
	if (direction !== "above" && direction !== "below")
		throw new RangeError("Threshold direction must be above or below");
	if (![enterThreshold, exitThreshold].every(Number.isFinite))
		throw new RangeError("Thresholds must be finite");
	const ordered =
		direction === "above"
			? enterThreshold > exitThreshold
			: enterThreshold < exitThreshold;
	if (!ordered)
		throw new RangeError(
			"Enter and exit thresholds must define a non-empty hysteresis band",
		);
};
const compareThreshold = (
	value: number | null,
	previous: PoseRuleStatus,
	threshold: PoseThreshold,
): boolean | "unknown" => {
	if (value === null || !Number.isFinite(value)) return "unknown";
	const hasEntered =
		threshold.direction === "above"
			? value >= threshold.enterThreshold
			: value <= threshold.enterThreshold;
	const hasExited =
		threshold.direction === "above"
			? value <= threshold.exitThreshold
			: value >= threshold.exitThreshold;
	if (hasEntered) return true;
	if (hasExited) return false;
	if (previous === "unknown") return "unknown";
	return previous === "pass";
};
export const evaluatePoseThreshold = (
	value: number | null,
	previous: PoseRuleStatus,
	threshold: PoseThreshold,
): boolean | "unknown" => {
	validateThreshold(threshold);
	return compareThreshold(value, previous, threshold);
};
export interface ThresholdRuleOptions<Name extends LandmarkName>
	extends Omit<PoseRuleOptions<Name>, "evaluate">,
		PoseThreshold {
	measure: (
		pose: Readonly<Record<Name, Landmark>>,
		frame: PoseFrame,
	) => number | null;
}
export const createThresholdRule = <Name extends LandmarkName>(
	options: ThresholdRuleOptions<Name>,
): PoseRuleOptions<Name> => {
	validatePoseRuleOptions(options);
	const { measure, direction, enterThreshold, exitThreshold, ...rule } =
		options;
	const threshold = { direction, enterThreshold, exitThreshold };
	validateThreshold(threshold);
	return {
		...rule,
		resetKey: JSON.stringify([
			rule.resetKey,
			direction,
			enterThreshold,
			exitThreshold,
		]),
		evaluate: (pose, frame, previous) =>
			compareThreshold(measure(pose, frame), previous, threshold),
	};
};
