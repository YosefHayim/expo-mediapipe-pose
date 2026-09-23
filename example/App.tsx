import { useCameraPermissions } from "expo-camera";
import {
	composeSkeletonFeedback,
	createThresholdRule,
	getImageJointAngle,
	type InferenceError,
	PoseCameraView,
	type PoseFrame,
	type PosePerformanceMetrics,
	usePoseRules,
	usePoseTracking,
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
import { CameraControls, type CameraSelection } from "./CameraControls";
import {
	feedbackLabels,
	jointFeedbackStyles,
	trackingLabels,
} from "./poseFeedback";

const wristFeedback = jointFeedbackStyles("leftWrist");
const elbowFeedback = jointFeedbackStyles("leftElbow");

export default function App() {
	const [permission, requestPermission] = useCameraPermissions();
	const [cameraSelection, setCameraSelection] = React.useState<CameraSelection>(
		{
			facing: "front",
			lens: "wide",
			previewFps: 30,
		},
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
	const feedback = usePoseRules({
		raisedArm: {
			landmarks: ["leftWrist", "leftShoulder"],
			holdMs: 250,
			isActive,
			evaluate: (pose) => pose.leftWrist.y < pose.leftShoulder.y,
		},
		elbowBend: createThresholdRule({
			landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
			isActive,
			holdMs: 250,
			direction: "below",
			enterThreshold: 85,
			exitThreshold: 95,
			measure: (_pose, frame) => {
				const angle = getImageJointAngle(
					{ landmarks: frame.landmarks, imageSize: frame.additionalData },
					"leftShoulder",
					"leftElbow",
					"leftWrist",
				);
				if (angle.status === "unavailable") return null;
				return angle.value;
			},
		}),
	});
	const feedbackSkeleton = composeSkeletonFeedback(
		{
			color: "#94a3b8",
			bodyParts: ["leftArm", "torso"],
			joints: { leftWrist: { radius: 8 } },
		},
		[
			{ status: feedback.statuses.raisedArm, styles: wristFeedback },
			{ status: feedback.statuses.elbowBend, styles: elbowFeedback },
		],
	);
	const tracking = usePoseTracking({
		landmarks: ["leftShoulder", "leftElbow", "leftWrist"],
		isActive,
		holdMs: 400,
	});
	const handleLandmark = React.useCallback(
		(frame: PoseFrame) => {
			tracking.update(frame);
			feedback.update(frame);
		},
		[tracking.update, feedback.update],
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

	const selectCamera = (selection: CameraSelection) => {
		setMetrics(null);
		feedback.reset();
		tracking.reset();
		setCameraSelection(selection);
		setFailure(null);
		setCameraKey((previous) => previous + 1);
	};
	const retryCamera = () => {
		setMetrics(null);
		setFailure(null);
		feedback.reset();
		tracking.reset();
		setCameraKey((previous) => previous + 1);
	};
	const handleFailure = (error: InferenceError) => {
		setMetrics(null);
		feedback.reset();
		tracking.reset();
		setFailure(error);
	};
	const handleConfiguration = () => {
		setMetrics(null);
		feedback.reset();
		tracking.reset();
		setFailure(null);
	};

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>MediaPipe Pose</Text>
			<Text style={styles.text}>{trackingLabels[tracking.status]}</Text>
			<Text style={styles.text}>
				{feedbackLabels[feedback.statuses.raisedArm]}
			</Text>
			<Text style={styles.text}>
				Elbow feedback: {feedback.statuses.elbowBend}
			</Text>
			<PoseCameraView
				key={cameraKey}
				style={styles.camera}
				cameraFacing={cameraSelection.facing}
				cameraLens={cameraSelection.lens}
				isActive={isActive}
				frameLimit={frameLimit}
				previewFps={cameraSelection.previewFps}
				callbackFps={5}
				onPerformanceMetrics={setMetrics}
				onLandmark={handleLandmark}
				onCameraConfigured={handleConfiguration}
				onInferenceError={handleFailure}
				skeleton={feedbackSkeleton}
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
				<CameraControls selection={cameraSelection} onSelect={selectCamera} />
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
