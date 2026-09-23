import type {
	LandmarkName,
	PoseRuleStatus,
	PoseTrackingStatus,
	SkeletonFeedback,
} from "expo-mediapipe-pose";

export const feedbackColors: Record<PoseRuleStatus, string> = {
	pass: "#22c55e",
	fail: "#ef4444",
	unknown: "#94a3b8",
};
export const feedbackLabels: Record<PoseRuleStatus, string> = {
	pass: "Wrist raised",
	fail: "Raise your left wrist above your shoulder",
	unknown: "Keep your left arm visible",
};

export const trackingLabels: Record<PoseTrackingStatus, string> = {
	searching: "Waiting for a camera result",
	acquiring: "Keep your left arm visible briefly",
	found: "Left arm tracked",
	lost: "Step into the frame",
	incomplete: "Keep your left shoulder, elbow and wrist visible",
	stale: "Waiting for fresh camera results",
	inactive: "Tracking paused",
};

export const jointFeedbackStyles = (
	name: LandmarkName,
): SkeletonFeedback["styles"] => ({
	pass: { joints: { [name]: { color: feedbackColors.pass } } },
	fail: { joints: { [name]: { color: feedbackColors.fail } } },
	unknown: { joints: { [name]: { color: feedbackColors.unknown } } },
});
