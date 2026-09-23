import { useCameraPermissions } from "expo-camera";
import {
	getImageJointAngle,
	type InferenceError,
	PoseCameraView,
	type PoseFrame,
	type PosePerformanceMetrics,
	type PoseRuleStatus,
	usePoseRule,
} from "expo-mediapipe-pose";
import * as React from "react";
import {
	AppState,
	Button,
	Linking,
	StyleSheet,
	Text,
	View,
} from "react-native";

const feedbackColors: Record<PoseRuleStatus, string> = {
	pass: "#22c55e",
	fail: "#ef4444",
	unknown: "#94a3b8",
};
const feedbackLabels: Record<PoseRuleStatus, string> = {
	pass: "Wrist raised",
	fail: "Raise your left wrist above your shoulder",
	unknown: "Keep your left arm visible",
};

export default function App() {
	const [permission, requestPermission] = useCameraPermissions();
	const [cameraFacing, setCameraFacing] = React.useState<"front" | "back">(
		"front",
	);
	const [paused, setPaused] = React.useState(false);
	const [foreground, setForeground] = React.useState(
		AppState.currentState === "active",
	);
	const [failure, setFailure] = React.useState<InferenceError | null>(null);
	const [cameraKey, setCameraKey] = React.useState(0);
	const [frameLimit, setFrameLimit] = React.useState(15);
	const [metrics, setMetrics] = React.useState<PosePerformanceMetrics | null>(
		null,
	);
	const isActive = foreground && !paused;
	const displayedMetrics = isActive ? metrics : null;
	React.useEffect(() => {
		if (!isActive) setMetrics(null);
	}, [isActive]);
	const raisedArm = usePoseRule({
		landmarks: ["leftWrist", "leftShoulder"],
		holdMs: 250,
		isActive,
		evaluate: (pose) => pose.leftWrist.y < pose.leftShoulder.y,
	});

	const elbowBend = usePoseRule({
		landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
		isActive,
		holdMs: 250,
		evaluate: (_pose, frame) => {
			const angle = getImageJointAngle(
				{ landmarks: frame.landmarks, imageSize: frame.additionalData },
				"leftShoulder",
				"leftElbow",
				"leftWrist",
			);
			if (angle.status === "unavailable") return "unknown";
			return angle.value < 90;
		},
	});
	const handleLandmark = React.useCallback(
		(frame: PoseFrame) => {
			raisedArm.update(frame);
			elbowBend.update(frame);
		},
		[raisedArm.update, elbowBend.update],
	);

	React.useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		setForeground(AppState.currentState === "active");
		return () => subscription.remove();
	}, []);

	if (!permission)
		return (
			<View style={styles.screen}>
				<Text style={styles.text}>Checking camera permission…</Text>
			</View>
		);
	if (!permission.granted) {
		const permissionAction = permission.canAskAgain
			? requestPermission
			: Linking.openSettings;
		const permissionLabel = permission.canAskAgain
			? "Allow camera"
			: "Open settings";
		return (
			<View style={styles.screen}>
				<Text style={styles.text}>
					Pose detection runs on your device. Camera access is required.
				</Text>
				<Button title={permissionLabel} onPress={permissionAction} />
			</View>
		);
	}

	const switchCamera = () => {
		setMetrics(null);
		raisedArm.reset();
		elbowBend.reset();
		setCameraFacing((previous) => (previous === "front" ? "back" : "front"));
	};
	const retryCamera = () => {
		setMetrics(null);
		setFailure(null);
		raisedArm.reset();
		elbowBend.reset();
		setCameraKey((previous) => previous + 1);
	};
	const handleFailure = (error: InferenceError) => {
		setMetrics(null);
		raisedArm.reset();
		elbowBend.reset();
		setFailure(error);
	};
	const handleConfiguration = () => {
		setMetrics(null);
		raisedArm.reset();
		elbowBend.reset();
		setFailure(null);
	};

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>MediaPipe Pose</Text>
			<Text style={styles.text}>{feedbackLabels[raisedArm.status]}</Text>
			<Text style={styles.text}>Elbow below 90°: {elbowBend.status}</Text>
			<PoseCameraView
				key={cameraKey}
				style={styles.camera}
				cameraFacing={cameraFacing}
				isActive={isActive}
				frameLimit={frameLimit}
				previewFps={30}
				callbackFps={5}
				onPerformanceMetrics={setMetrics}
				onLandmark={handleLandmark}
				onCameraConfigured={handleConfiguration}
				onInferenceError={handleFailure}
				skeleton={{
					color: feedbackColors[raisedArm.status],
					bodyParts: ["leftArm", "torso"],
					joints: { leftWrist: { radius: 8 } },
				}}
			/>
			{displayedMetrics && (
				<Text style={styles.text}>
					Inference: {displayedMetrics.inferenceFps.toFixed(1)} fps · Results:{" "}
					{displayedMetrics.resultFps.toFixed(1)} fps
				</Text>
			)}
			<Button
				title={`Inference limit: ${frameLimit} fps`}
				onPress={() => setFrameLimit((previous) => (previous === 15 ? 30 : 15))}
			/>
			{failure && (
				<View>
					<Text style={styles.text}>Camera error: {failure.code}</Text>
					<Button title="Retry camera" onPress={retryCamera} />
				</View>
			)}
			<View style={styles.actions}>
				<Button title="Switch camera" onPress={switchCamera} />
				<Button
					title={paused ? "Resume" : "Pause"}
					onPress={() => setPaused((value) => !value)}
				/>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		backgroundColor: "#111827",
		padding: 24,
		paddingTop: 64,
		gap: 16,
	},
	title: { color: "white", fontSize: 24, fontWeight: "600" },
	text: { color: "white", fontSize: 16 },
	camera: { flex: 1, borderRadius: 16 },
	actions: { flexDirection: "row", justifyContent: "space-between" },
});
