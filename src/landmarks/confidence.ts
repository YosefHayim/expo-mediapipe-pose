import type { Landmark } from "../contracts";

export const hasLandmarkConfidence = (joint: Landmark, minimum: number) => {
	const isJointVisibilityMissing = joint.visibility === undefined;
	if (isJointVisibilityMissing) return false;

	const isNotJointVisibilityFinite = !Number.isFinite(joint.visibility);
	if (isNotJointVisibilityFinite) return false;

	const isVisibilityOutOfRange =
		joint.visibility < minimum || joint.visibility > 1;
	if (isVisibilityOutOfRange) return false;

	const isJointPresenceMissing = joint.presence === undefined;
	if (isJointPresenceMissing) return true;

	const isNotJointPresenceFinite = !Number.isFinite(joint.presence);
	if (isNotJointPresenceFinite) return false;

	return joint.presence >= minimum && joint.presence <= 1;
};
