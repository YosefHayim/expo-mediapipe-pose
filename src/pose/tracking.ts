import type { PoseFrame } from "../contracts";
import { hasLandmarkConfidence } from "./confidence";
import { LANDMARK_NAMES, type LandmarkName } from "./landmarks";
import { type PoseRuleOptions, validatePoseRuleOptions } from "./poseRule";

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
	if (options.isActive === false) return trackingState("inactive");
	if (frame.landmarks.length === 0) return trackingState("lost");
	const missingLandmarks: LandmarkName[] = [];
	const uncertainLandmarks: LandmarkName[] = [];
	const outsideImageLandmarks: LandmarkName[] = [];
	for (const name of new Set(options.landmarks)) {
		const joint = frame.landmarks[LANDMARK_NAMES.indexOf(name)];
		if (!joint) {
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
		if (!finiteCoordinates || !confident) {
			uncertainLandmarks.push(name);
			continue;
		}
		const insideImage = [joint.x, joint.y].every(
			(value) => value >= 0 && value <= 1,
		);
		if (!insideImage) outsideImageLandmarks.push(name);
	}
	const unavailableLandmarkCount =
		missingLandmarks.length +
		uncertainLandmarks.length +
		outsideImageLandmarks.length;
	return {
		status: unavailableLandmarkCount === 0 ? "found" : "incomplete",
		missingLandmarks,
		uncertainLandmarks,
		outsideImageLandmarks,
	};
};
