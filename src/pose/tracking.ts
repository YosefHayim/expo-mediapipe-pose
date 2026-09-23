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
	status: PoseTrackingStatus;
	missingLandmarks: readonly LandmarkName[];
	uncertainLandmarks: readonly LandmarkName[];
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
		if (!finiteCoordinates || !confident) uncertainLandmarks.push(name);
	}
	const complete = missingLandmarks.length + uncertainLandmarks.length === 0;
	return {
		status: complete ? "found" : "incomplete",
		missingLandmarks,
		uncertainLandmarks,
	};
};
