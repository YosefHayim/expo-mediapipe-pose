import { analyzePoseImage, selectPose } from "expo-mediapipe-pose";
import { verifyCheck } from "./verify-check";

export const runMultiplePoseChecks = async (
	location: string,
	cases: string[],
) => {
	const detection = await analyzePoseImage(location, { maxPoses: 2 });
	verifyCheck(
		detection.poses?.length === 2,
		`Expected two people, received ${detection.poses?.length}`,
	);
	for (const pose of detection.poses) {
		verifyCheck(
			pose.landmarks.length === 33,
			"Every pose must expose image landmarks",
		);
		verifyCheck(
			pose.worldLandmarks.length === 33,
			"Every pose must expose world landmarks",
		);
	}
	verifyCheck(
		JSON.stringify(detection.poses[0]) !== JSON.stringify(detection.poses[1]),
		"The two-person fixture must return distinct pose data",
	);
	verifyCheck(
		JSON.stringify(detection.landmarks) ===
			JSON.stringify(detection.poses[0]?.landmarks),
		"First-pose image alias must match index zero",
	);
	verifyCheck(
		JSON.stringify(detection.worldLandmarks) ===
			JSON.stringify(detection.poses[0]?.worldLandmarks),
		"First-pose world alias must match index zero",
	);
	const second = selectPose(detection, 1);
	verifyCheck(
		JSON.stringify(second.landmarks) ===
			JSON.stringify(detection.poses[1]?.landmarks),
		"Selection must expose the second pose image landmarks",
	);
	verifyCheck(
		JSON.stringify(second.worldLandmarks) ===
			JSON.stringify(detection.poses[1]?.worldLandmarks),
		"Selection must expose the second pose world landmarks",
	);
	verifyCheck(
		selectPose(detection, 2).landmarks.length === 0,
		"Missing selection must be empty",
	);
	cases.push("real two-person image and explicit pose selection");
	const single = await analyzePoseImage(location, { maxPoses: 1 });
	verifyCheck(
		single.poses?.length === 1,
		"maxPoses must limit native detections",
	);
	cases.push("native maximum pose count");
};
