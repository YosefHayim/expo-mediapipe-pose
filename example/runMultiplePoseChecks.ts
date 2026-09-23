import { analyzePoseImage, selectPose } from "expo-mediapipe-pose";

function verify(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
export async function runMultiplePoseChecks(location: string, cases: string[]) {
	const detection = await analyzePoseImage(location, { maxPoses: 2 });
	verify(
		detection.poses?.length === 2,
		`Expected two people, received ${detection.poses?.length}`,
	);
	for (const pose of detection.poses) {
		verify(
			pose.landmarks.length === 33,
			"Every pose must expose image landmarks",
		);
		verify(
			pose.worldLandmarks.length === 33,
			"Every pose must expose world landmarks",
		);
	}
	verify(
		JSON.stringify(detection.landmarks) ===
			JSON.stringify(detection.poses[0]?.landmarks),
		"First-pose image alias must match index zero",
	);
	verify(
		JSON.stringify(detection.worldLandmarks) ===
			JSON.stringify(detection.poses[0]?.worldLandmarks),
		"First-pose world alias must match index zero",
	);
	const second = selectPose(detection, 1);
	verify(
		JSON.stringify(second.landmarks) ===
			JSON.stringify(detection.poses[1]?.landmarks),
		"Selection must expose the second pose image landmarks",
	);
	verify(
		JSON.stringify(second.worldLandmarks) ===
			JSON.stringify(detection.poses[1]?.worldLandmarks),
		"Selection must expose the second pose world landmarks",
	);
	verify(
		selectPose(detection, 2).landmarks.length === 0,
		"Missing selection must be empty",
	);
	cases.push("real two-person image and explicit pose selection");
	const single = await analyzePoseImage(location, { maxPoses: 1 });
	verify(single.poses?.length === 1, "maxPoses must limit native detections");
	cases.push("native maximum pose count");
}
