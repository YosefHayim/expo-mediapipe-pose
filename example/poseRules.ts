import type { PoseRuleOptions } from "expo-mediapipe-pose";

export const raisedArmRule: PoseRuleOptions<"leftWrist" | "leftShoulder"> = {
	landmarks: ["leftWrist", "leftShoulder"],
	holdMs: 250,
	evaluate: (pose) => pose.leftWrist.y < pose.leftShoulder.y,
};
