import type { Landmark, PoseLandmarks } from "../contracts";

export type SelectablePose = {
	readonly landmarks: readonly Landmark[];
	readonly worldLandmarks?: readonly Landmark[];
	readonly poses?: readonly PoseLandmarks[] | undefined;
};

/** A view of one result index, never a persistent person identity. Missing indices have empty landmarks. */
export const selectPose = <Frame extends SelectablePose>(
	frame: Frame,
	poseIndex: number,
): Frame => {
	const isPoseIndexOutOfRange =
		!Number.isInteger(poseIndex) || poseIndex < 0 || poseIndex > 5;
	if (isPoseIndexOutOfRange)
		throw new RangeError("poseIndex must be an integer from 0 to 5");

	// Version-one recordings made before multi-pose support only contain the first pose fields.
	const isNoPosesAtFirstIndex = frame.poses == null && poseIndex === 0;
	if (isNoPosesAtFirstIndex) return frame;

	const selected = frame.poses?.[poseIndex];

	const isSelectedMissing = selected == null;
	if (isSelectedMissing) return { ...frame, landmarks: [], worldLandmarks: [] };

	return {
		...frame,
		landmarks: selected.landmarks,
		worldLandmarks: selected.worldLandmarks,
	};
};
