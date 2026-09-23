import type { Landmark } from "../contracts";

export const hasLandmarkConfidence = (joint: Landmark, minimum: number) => {
	if (joint.visibility === undefined) return false;
	if (!Number.isFinite(joint.visibility)) return false;
	if (joint.visibility < minimum || joint.visibility > 1) return false;
	if (joint.presence === undefined) return true;
	if (!Number.isFinite(joint.presence)) return false;
	return joint.presence >= minimum && joint.presence <= 1;
};
