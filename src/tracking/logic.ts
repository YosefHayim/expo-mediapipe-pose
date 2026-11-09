import type { PoseFrame } from "../contracts";
import { hasLandmarkConfidence } from "../landmarks/confidence";
import { LANDMARK_NAMES, type LandmarkName } from "../landmarks/names";
import { type PoseRuleOptions, validatePoseRuleOptions } from "../rules/rule";

export type PoseTrackingStatus =
	| "searching"
	| "acquiring"
	| "found"
	| "lost"
	| "incomplete"
	| "stale"
	| "inactive";
export interface PoseTrackingState {
	readonly status: PoseTrackingStatus;
	readonly missingLandmarks: readonly LandmarkName[];
	readonly uncertainLandmarks: readonly LandmarkName[];
	readonly outsideImageLandmarks: readonly LandmarkName[];
}
export interface PoseTrackingOptions
	extends Pick<
		PoseRuleOptions,
		"landmarks" | "minVisibility" | "holdMs" | "staleAfterMs" | "isActive"
	> {
	onChange?: (state: PoseTrackingState) => void;
}
export const trackingState = (
	status: PoseTrackingStatus,
): PoseTrackingState => ({
	status,
	missingLandmarks: [],
	uncertainLandmarks: [],
	outsideImageLandmarks: [],
});
export const inspectPoseTracking = (
	frame: PoseFrame,
	options: PoseTrackingOptions,
): PoseTrackingState => {
	validatePoseRuleOptions(options);

	const isIsActiveFalse = options.isActive === false;
	if (isIsActiveFalse) return trackingState("inactive");

	const isFrameLandmarksEmpty = frame.landmarks.length === 0;
	if (isFrameLandmarksEmpty) return trackingState("lost");

	const missingLandmarks: LandmarkName[] = [];
	const uncertainLandmarks: LandmarkName[] = [];
	const outsideImageLandmarks: LandmarkName[] = [];
	for (const name of new Set(options.landmarks)) {
		const joint = frame.landmarks[LANDMARK_NAMES.indexOf(name)];

		const isJointMissing = !joint;
		if (isJointMissing) {
			missingLandmarks.push(name);
			continue;
		}

		const finiteCoordinates = [joint.x, joint.y, joint.z].every(
			Number.isFinite,
		);

		const confident = hasLandmarkConfidence(
			joint,
			options.minVisibility ?? 0.6,
		);

		const isNotFiniteCoordinatesOrConfident = !finiteCoordinates || !confident;
		if (isNotFiniteCoordinatesOrConfident) {
			uncertainLandmarks.push(name);
			continue;
		}

		const insideImage = [joint.x, joint.y].every(
			(value) => value >= 0 && value <= 1,
		);

		const isInsideImageMissing = !insideImage;
		if (isInsideImageMissing) outsideImageLandmarks.push(name);
	}
	const unavailableLandmarkCount =
		missingLandmarks.length +
		uncertainLandmarks.length +
		outsideImageLandmarks.length;
	const isUnavailableLandmarkCount0 = unavailableLandmarkCount === 0;
	return {
		status: isUnavailableLandmarkCount0 ? "found" : "incomplete",
		missingLandmarks,
		uncertainLandmarks,
		outsideImageLandmarks,
	};
};
