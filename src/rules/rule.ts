import type { Landmark, PoseFrame } from "../contracts";
import { hasLandmarkConfidence } from "../landmarks/confidence";
import { getNamedLandmarks, type LandmarkName } from "../landmarks/names";

export type PoseRuleStatus = "pass" | "fail" | "unknown";

export interface PoseRuleOptions<Name extends LandmarkName = LandmarkName> {
	landmarks: readonly Name[];
	evaluate: (
		pose: Readonly<Record<Name, Landmark>>,
		frame: PoseFrame,
		previousVerdict: PoseRuleStatus,
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
	settings: Pick<
		PoseRuleOptions,
		"landmarks" | "minVisibility" | "holdMs" | "staleAfterMs" | "resetKey"
	>,
) => {
	const invalidResetKey =
		typeof settings.resetKey === "number" &&
		!Number.isFinite(settings.resetKey);
	if (invalidResetKey) throw new RangeError("Numeric resetKey must be finite");

	const isLandmarksEmpty = settings.landmarks.length === 0;
	if (isLandmarksEmpty)
		throw new RangeError("A pose rule requires at least one landmark");

	const visibility = settings.minVisibility ?? 0.6;

	const visibilityInRange = visibility >= 0 && visibility <= 1;

	const hasInvalidVisibility =
		!Number.isFinite(visibility) || !visibilityInRange;
	if (hasInvalidVisibility) {
		throw new RangeError("minVisibility must be between 0 and 1");
	}

	for (const duration of [settings.holdMs ?? 0, settings.staleAfterMs ?? 500]) {
		const isDurationInvalid = !Number.isFinite(duration) || duration < 0;
		if (isDurationInvalid)
			throw new RangeError("Rule durations must be finite and non-negative");
	}

	const isStaleAfterZero = settings.staleAfterMs === 0;
	if (isStaleAfterZero) throw new RangeError("staleAfterMs must be positive");
};

/** Confidence is a prerequisite for evaluating a condition, not its pass/fail result. */
export const evaluatePoseRule = <Name extends LandmarkName>(
	frame: PoseFrame,
	settings: PoseRuleOptions<Name>,
	previousVerdict: PoseRuleStatus = "unknown",
): PoseRuleStatus => {
	const isRuleInactive = settings.isActive === false;
	if (isRuleInactive) return "unknown";

	const pose = getNamedLandmarks(frame);
	const minimumConfidence = settings.minVisibility ?? 0.6;

	const hasUncertainLandmark = settings.landmarks.some((name) => {
		const joint = pose[name];

		const isJointMissing = joint == null;
		if (isJointMissing) return true;

		const coordinatesAreFinite = [joint.x, joint.y, joint.z].every(
			Number.isFinite,
		);

		const hasNonFiniteCoordinates = !coordinatesAreFinite;
		if (hasNonFiniteCoordinates) return true;

		return !hasLandmarkConfidence(joint, minimumConfidence);
	});
	if (hasUncertainLandmark) return "unknown";

	// Every requested key has been checked above; other landmarks remain optional internally.
	const verdict = settings.evaluate(
		pose as Record<Name, Landmark>,
		frame,
		previousVerdict,
	);

	const isVerdictUnknown = verdict === "unknown";
	if (isVerdictUnknown) return "unknown";

	return verdict ? "pass" : "fail";
};

/** Uses a caller-supplied monotonic clock. Unknown invalidates feedback immediately. */
export const advancePoseRule = (
	previous: PoseRuleState,
	verdict: PoseRuleStatus,
	now: number,
	holdMs = 0,
): PoseRuleState => {
	const timeIsValid = Number.isFinite(now) && now >= 0;

	const holdIsValid = Number.isFinite(holdMs) && holdMs >= 0;

	const hasInvalidTimeOrHold = !timeIsValid || !holdIsValid;
	if (hasInvalidTimeOrHold) {
		throw new RangeError(
			"Rule time and hold duration must be finite and non-negative",
		);
	}

	const isVerdictUnknown = verdict === "unknown";
	if (isVerdictUnknown)
		return {
			status: "unknown",
			candidate: "unknown",
			since: now,
			updatedAt: now,
		};

	const hasCandidateChangedOrClockReversed =
		verdict !== previous.candidate || now < previous.updatedAt;
	const since = hasCandidateChangedOrClockReversed ? now : previous.since;
	const isHoldComplete = now - since >= holdMs;
	return {
		candidate: verdict,
		since,
		updatedAt: now,
		status: isHoldComplete ? verdict : previous.status,
	};
};

export const definePoseRule = <Name extends LandmarkName>(
	settings: PoseRuleOptions<Name>,
) => settings;
