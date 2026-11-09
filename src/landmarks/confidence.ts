import type { Landmark } from "../contracts";

export const hasLandmarkConfidence = (joint: Landmark, minimum: number) => {
	const isJointVisibilityMissing = joint.visibility === undefined;
	if (isJointVisibilityMissing) return false;

	const hasNonFiniteVisibility = !Number.isFinite(joint.visibility);
	if (hasNonFiniteVisibility) return false;

	const isVisibilityOutOfRange =
		joint.visibility < minimum || joint.visibility > 1;
	if (isVisibilityOutOfRange) return false;

	const isJointPresenceMissing = joint.presence === undefined;
	if (isJointPresenceMissing) return true;

	const hasNonFinitePresence = !Number.isFinite(joint.presence);
	if (hasNonFinitePresence) return false;

	return joint.presence >= minimum && joint.presence <= 1;
};
