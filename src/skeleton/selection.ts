import type { Landmark, PoseLandmarks } from "../contracts";

export type SelectablePose = {
	readonly landmarks: readonly Landmark[];
	readonly worldLandmarks?: readonly Landmark[];
	readonly poses?: readonly PoseLandmarks[] | undefined;
};

/** A view of one result index, never a persistent person identity. Missing indices have empty landmarks. */
export function selectPose<Frame extends SelectablePose>(
	frame: Frame,
	poseIndex: number,
): Frame {
	if (!Number.isInteger(poseIndex) || poseIndex < 0 || poseIndex > 5)
		throw new RangeError("poseIndex must be an integer from 0 to 5");
	// Version-one recordings made before multi-pose support only contain the first pose fields.
	if (frame.poses === undefined && poseIndex === 0) return frame;
	const selected = frame.poses?.[poseIndex];
	if (selected === undefined)
		return { ...frame, landmarks: [], worldLandmarks: [] };
	return {
		...frame,
		landmarks: selected.landmarks,
		worldLandmarks: selected.worldLandmarks,
	};
}
