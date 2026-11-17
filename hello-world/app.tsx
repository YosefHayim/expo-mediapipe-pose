// 1. Install. In a new Expo app, run these two commands, then make a
//    development build (Expo Go cannot load this module):
//      pnpm add expo-mediapipe-pose
//      pnpm exec expo install react-native-svg expo-camera
import { useCameraPermissions } from "expo-camera";
import type { PoseFrame } from "expo-mediapipe-pose";
import { PoseCameraView, usePoseRule } from "expo-mediapipe-pose";
import { Button, StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
	screen: { flex: 1 },
	camera: { flex: 1 },
	status: { padding: 16, fontSize: 20, textAlign: "center" },
});

function isBothWristsAboveNose(pose: {
	leftWrist: { y: number };
	rightWrist: { y: number };
	nose: { y: number };
}) {
	// Image y grows downward, so a smaller y means higher in the picture.
	const isLeftWristAboveNose = pose.leftWrist.y < pose.nose.y;
	const isRightWristAboveNose = pose.rightWrist.y < pose.nose.y;
	return isLeftWristAboveNose && isRightWristAboveNose;
}

export default function HelloPose() {
	// 2. Ask for the camera. Pose tracking runs on the phone, no frame leaves it.
	const [permission, requestPermission] = useCameraPermissions();

	// 3. Write your own condition. The rule reports "pass", "fail" or
	//    "unknown" (unknown means a landmark was not seen clearly enough).
	const handsUp = usePoseRule({
		landmarks: ["leftWrist", "rightWrist", "nose"],
		evaluate: isBothWristsAboveNose,
	});

	// 4. Read the landmarks. Each frame holds up to 33 named points per
	//    person. Hand every frame to the rule so it can check your condition.
	function handleFrame(frame: PoseFrame) {
		handsUp.update(frame);
	}

	const isCameraAllowed = permission?.granted === true;
	if (!isCameraAllowed) {
		return <Button title="Allow camera" onPress={requestPermission} />;
	}

	// 5. Color the skeleton by the rule status: green when both hands are up.
	const isHandsUp = handsUp.status === "pass";
	const skeletonColor = isHandsUp ? "#22c55e" : "#ffffff";

	// 6. Show the camera. PoseCameraView draws the skeleton for you.
	return (
		<View style={styles.screen}>
			<PoseCameraView
				style={styles.camera}
				onLandmark={handleFrame}
				skeleton={{ color: skeletonColor }}
			/>
			<Text style={styles.status}>Hands up: {handsUp.status}</Text>
		</View>
	);
}
