import type { Landmark, PoseFrame } from "../contracts";
import type { LandmarkName } from "../landmarks/names";
import {
	type PoseRuleOptions,
	type PoseRuleStatus,
	validatePoseRuleOptions,
} from "./rule";

export interface PoseThreshold {
	direction: "above" | "below";
	enterThreshold: number;
	exitThreshold: number;
}
const validateThreshold = (threshold: PoseThreshold) => {
	const { direction, enterThreshold, exitThreshold } = threshold;

	const isDirectionInvalid = direction !== "above" && direction !== "below";
	if (isDirectionInvalid)
		throw new RangeError("Threshold direction must be above or below");

	const hasNonFiniteThreshold = ![enterThreshold, exitThreshold].every(
		Number.isFinite,
	);
	if (hasNonFiniteThreshold) throw new RangeError("Thresholds must be finite");

	const isDirectionAbove = direction === "above";
	const ordered = isDirectionAbove
		? enterThreshold > exitThreshold
		: enterThreshold < exitThreshold;

	const isUnordered = !ordered;
	if (isUnordered)
		throw new RangeError(
			"Enter and exit thresholds must define a non-empty hysteresis band",
		);
};
const compareThreshold = (
	reading: number | null,
	previous: PoseRuleStatus,
	threshold: PoseThreshold,
): boolean | "unknown" => {
	const isMissingOrNotFinite = reading === null || !Number.isFinite(reading);
	if (isMissingOrNotFinite) return "unknown";

	const isAboveDirection = threshold.direction === "above";
	const hasEntered = isAboveDirection
		? reading >= threshold.enterThreshold
		: reading <= threshold.enterThreshold;
	const hasExited = isAboveDirection
		? reading <= threshold.exitThreshold
		: reading >= threshold.exitThreshold;

	if (hasEntered) return true;

	if (hasExited) return false;

	const isPreviousUnknown = previous === "unknown";
	if (isPreviousUnknown) return "unknown";

	return previous === "pass";
};
export const evaluatePoseThreshold = (
	reading: number | null,
	previous: PoseRuleStatus,
	threshold: PoseThreshold,
): boolean | "unknown" => {
	validateThreshold(threshold);
	return compareThreshold(reading, previous, threshold);
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
	settings: ThresholdRuleOptions<Name>,
): PoseRuleOptions<Name> => {
	validatePoseRuleOptions(settings);
	const { measure, direction, enterThreshold, exitThreshold, ...rule } =
		settings;
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
