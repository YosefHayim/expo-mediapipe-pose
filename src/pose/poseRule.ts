import type { Landmark, PoseFrame } from "../contracts";
import { getNamedLandmarks, type LandmarkName } from "./landmarks";

export type PoseRuleStatus = "pass" | "fail" | "unknown";

export interface PoseRuleOptions<Name extends LandmarkName = LandmarkName> {
	landmarks: readonly Name[];
	evaluate: (
		pose: Readonly<Record<Name, Landmark>>,
		frame: PoseFrame,
	) => boolean | "unknown";
	minVisibility?: number;
	holdMs?: number;
	staleAfterMs?: number;
	isActive?: boolean;
	onChange?: (status: PoseRuleStatus) => void;
}

export interface PoseRuleState {
	status: PoseRuleStatus;
	candidate: PoseRuleStatus;
	since: number;
	updatedAt: number;
}

export const initialPoseRuleState = (): PoseRuleState => ({
	status: "unknown",
	candidate: "unknown",
	since: 0,
	updatedAt: 0,
});

export const validatePoseRuleOptions = (
	options: Pick<
		PoseRuleOptions,
		"landmarks" | "minVisibility" | "holdMs" | "staleAfterMs"
	>,
) => {
	if (options.landmarks.length === 0)
		throw new RangeError("A pose rule requires at least one landmark");
	const visibility = options.minVisibility ?? 0.6;
	const visibilityInRange = visibility >= 0 && visibility <= 1;
	if (!Number.isFinite(visibility) || !visibilityInRange) {
		throw new RangeError("minVisibility must be between 0 and 1");
	}
	for (const duration of [options.holdMs ?? 0, options.staleAfterMs ?? 500]) {
		if (!Number.isFinite(duration) || duration < 0)
			throw new RangeError("Rule durations must be finite and non-negative");
	}
	if (options.staleAfterMs === 0)
		throw new RangeError("staleAfterMs must be positive");
};

/** Confidence is a prerequisite for evaluating a condition, not its pass/fail result. */
export const evaluatePoseRule = <Name extends LandmarkName>(
	frame: PoseFrame,
	options: PoseRuleOptions<Name>,
): PoseRuleStatus => {
	if (options.isActive === false) return "unknown";
	const pose = getNamedLandmarks(frame);
	const minimumConfidence = options.minVisibility ?? 0.6;
	const hasUncertainLandmark = options.landmarks.some((name) => {
		const joint = pose[name];
		if (!joint) return true;
		const coordinatesAreFinite = [joint.x, joint.y, joint.z].every(
			Number.isFinite,
		);
		if (!coordinatesAreFinite) return true;
		if (joint.visibility === undefined) return true;
		if (!Number.isFinite(joint.visibility)) return true;
		if (joint.visibility < minimumConfidence) return true;
		if (joint.presence === undefined) return false;
		if (!Number.isFinite(joint.presence)) return true;
		return joint.presence < minimumConfidence;
	});
	if (hasUncertainLandmark) return "unknown";
	// Every requested key has been checked above; other landmarks remain optional internally.
	const outcome = options.evaluate(pose as Record<Name, Landmark>, frame);
	if (outcome === "unknown") return "unknown";
	return outcome ? "pass" : "fail";
};

/** Uses a caller-supplied monotonic clock. Unknown invalidates feedback immediately. */
export const advancePoseRule = (
	previous: PoseRuleState,
	outcome: PoseRuleStatus,
	now: number,
	holdMs = 0,
): PoseRuleState => {
	const timeIsValid = Number.isFinite(now) && now >= 0;
	const holdIsValid = Number.isFinite(holdMs) && holdMs >= 0;
	if (!timeIsValid || !holdIsValid) {
		throw new RangeError(
			"Rule time and hold duration must be finite and non-negative",
		);
	}
	if (outcome === "unknown")
		return {
			status: "unknown",
			candidate: "unknown",
			since: now,
			updatedAt: now,
		};
	const since =
		outcome !== previous.candidate || now < previous.updatedAt
			? now
			: previous.since;
	return {
		candidate: outcome,
		since,
		updatedAt: now,
		status: now - since >= holdMs ? outcome : previous.status,
	};
};
