import type { Landmark, PoseFrame } from "../contracts";
import { hasLandmarkConfidence } from "../landmarks/confidence";
import { getNamedLandmarks, type LandmarkName } from "../landmarks/names";

export type PoseRuleStatus = "pass" | "fail" | "unknown";

export interface PoseRuleOptions<Name extends LandmarkName = LandmarkName> {
	landmarks: readonly Name[];
	evaluate: (
		pose: Readonly<Record<Name, Landmark>>,
		frame: PoseFrame,
		previousOutcome: PoseRuleStatus,
	) => boolean | "unknown";
	minVisibility?: number;
	holdMs?: number;
	staleAfterMs?: number;
	isActive?: boolean;
	resetKey?: string | number;
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
		"landmarks" | "minVisibility" | "holdMs" | "staleAfterMs" | "resetKey"
	>,
) => {
	const invalidResetKey =
		typeof options.resetKey === "number" && !Number.isFinite(options.resetKey);
	if (invalidResetKey) throw new RangeError("Numeric resetKey must be finite");

	const isLandmarksEmpty = options.landmarks.length === 0;
	if (isLandmarksEmpty)
		throw new RangeError("A pose rule requires at least one landmark");

	const visibility = options.minVisibility ?? 0.6;

	const visibilityInRange = visibility >= 0 && visibility <= 1;

	const isNotVisibilityFiniteOrInRange =
		!Number.isFinite(visibility) || !visibilityInRange;
	if (isNotVisibilityFiniteOrInRange) {
		throw new RangeError("minVisibility must be between 0 and 1");
	}

	for (const duration of [options.holdMs ?? 0, options.staleAfterMs ?? 500]) {
		const isDurationInvalid = !Number.isFinite(duration) || duration < 0;
		if (isDurationInvalid)
			throw new RangeError("Rule durations must be finite and non-negative");
	}

	const isStaleAfterMs0 = options.staleAfterMs === 0;
	if (isStaleAfterMs0) throw new RangeError("staleAfterMs must be positive");
};

/** Confidence is a prerequisite for evaluating a condition, not its pass/fail result. */
export const evaluatePoseRule = <Name extends LandmarkName>(
	frame: PoseFrame,
	options: PoseRuleOptions<Name>,
	previousOutcome: PoseRuleStatus = "unknown",
): PoseRuleStatus => {
	const isRuleInactive = options.isActive === false;
	if (isRuleInactive) return "unknown";

	const pose = getNamedLandmarks(frame);
	const minimumConfidence = options.minVisibility ?? 0.6;

	const hasUncertainLandmark = options.landmarks.some((name) => {
		const joint = pose[name];

		const isJointMissing = !joint;
		if (isJointMissing) return true;

		const coordinatesAreFinite = [joint.x, joint.y, joint.z].every(
			Number.isFinite,
		);

		const isCoordinatesAreFiniteMissing = !coordinatesAreFinite;
		if (isCoordinatesAreFiniteMissing) return true;

		return !hasLandmarkConfidence(joint, minimumConfidence);
	});
	if (hasUncertainLandmark) return "unknown";

	// Every requested key has been checked above; other landmarks remain optional internally.
	const outcome = options.evaluate(
		pose as Record<Name, Landmark>,
		frame,
		previousOutcome,
	);

	const isOutcomeUnknown = outcome === "unknown";
	if (isOutcomeUnknown) return "unknown";

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

	const isNotTimeIsValidOrHoldIsValid = !timeIsValid || !holdIsValid;
	if (isNotTimeIsValidOrHoldIsValid) {
		throw new RangeError(
			"Rule time and hold duration must be finite and non-negative",
		);
	}

	const isOutcomeUnknown = outcome === "unknown";
	if (isOutcomeUnknown)
		return {
			status: "unknown",
			candidate: "unknown",
			since: now,
			updatedAt: now,
		};

	const hasCandidateChangedOrClockReversed =
		outcome !== previous.candidate || now < previous.updatedAt;
	const since = hasCandidateChangedOrClockReversed ? now : previous.since;
	const isHoldComplete = now - since >= holdMs;
	return {
		candidate: outcome,
		since,
		updatedAt: now,
		status: isHoldComplete ? outcome : previous.status,
	};
};

export const definePoseRule = <Name extends LandmarkName>(
	options: PoseRuleOptions<Name>,
) => options;
