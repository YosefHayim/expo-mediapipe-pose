import type { Landmark } from "../contracts";

export const hasLandmarkConfidence = (joint: Landmark, minimum: number) => {
	const visibility = joint.visibility;
	const isVisibilityMissing = visibility == null;
	if (isVisibilityMissing) return false;

	const hasNonFiniteVisibility = !Number.isFinite(visibility);
	if (hasNonFiniteVisibility) return false;

	const isVisibilityOutOfRange = visibility < minimum || visibility > 1;
	if (isVisibilityOutOfRange) return false;

	const presence = joint.presence;
	const isPresenceMissing = presence == null;
	if (isPresenceMissing) return true;

	const hasNonFinitePresence = !Number.isFinite(presence);
	if (hasNonFinitePresence) return false;

	return presence >= minimum && presence <= 1;
};
