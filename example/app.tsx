import { useCameraPermissions } from "expo-camera";
import {
	composeSkeletonFeedback,
	createPoseRecorder,
	createThresholdRule,
	getImageJointAngle,
	type InferenceError,
	PoseCameraView,
	type PoseFrame,
	type PosePerformanceMetrics,
	type PoseRecording,
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
import {
	createJointFeedbackStyles,
	feedbackLabels,
	trackingLabels,
} from "@/rules/pose-feedback";
import { raisedArmRule } from "@/rules/pose-rules";
import { CameraControls, type CameraSelection } from "./camera-controls";
import { PhotoPanel } from "./photo-panel";
import { ReplayPanel } from "./replay-panel";
import { VideoPanel } from "./video-panel";

const wristFeedback = createJointFeedbackStyles("leftWrist");
const elbowFeedback = createJointFeedbackStyles("leftElbow");

const App = () => {
	const [permission, requestPermission] = useCameraPermissions();
	const [cameraSelection, setCameraSelection] =
		React.useState<CameraSelection | null>(null);
	const [recorder] = React.useState(() =>
		createPoseRecorder({ maxFrames: 300 }),
	);
	const [recording, setRecording] = React.useState<PoseRecording | null>(null);
	const [recordingActive, setRecordingActive] = React.useState(false);
	const [recordingError, setRecordingError] = React.useState<string | null>(
		null,
	);
	const [mediaMode, setMediaMode] = React.useState<
		"camera" | "photo" | "video"
	>("camera");
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
	const liveCameraVisible = recording === null && mediaMode === "camera";
	const cameraInForeground = foreground && liveCameraVisible;
	const isActive = cameraInForeground && !paused;
	const displayedMetrics = isActive ? metrics : null;
	React.useEffect(() => {
		const isInactive = !isActive;
		if (isInactive) setMetrics(null);
	}, [isActive]);
	const feedback = usePoseRules({
		raisedArm: {
			...raisedArmRule,
			isActive,
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

				const isAngleStatusUnavailable = angle.status === "unavailable";
				if (isAngleStatusUnavailable) return null;

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
			try {
				const isFrameNotRecorded = !recorder.append(frame);
				if (isFrameNotRecorded) return;
			} catch (error) {
				setRecordingError(String(error));
				setRecordingActive(false);
				setRecording(recorder.stop());
				return;
			}

			const isRecorderStatusNotFull = recorder.status !== "full";
			if (isRecorderStatusNotFull) return;

			setRecordingActive(false);
			setRecording(recorder.stop());
		},
		[tracking.update, feedback.update, recorder],
	);

	React.useEffect(() => {
		const subscription = AppState.addEventListener("change", (appStatus) =>
			setForeground(appStatus === "active"),
		);
		setForeground(AppState.currentState === "active");
		return () => subscription.remove();
	}, []);

	const isMediaModeVideo = mediaMode === "video";
	if (isMediaModeVideo)
		return (
			<View style={styles.screen}>
				<VideoPanel onClose={() => setMediaMode("camera")} />
			</View>
		);

	const isMediaModePhoto = mediaMode === "photo";
	if (isMediaModePhoto)
		return (
			<View style={styles.screen}>
				<PhotoPanel onClose={() => setMediaMode("camera")} />
			</View>
		);

	const isPermissionMissing = permission == null;
	if (isPermissionMissing)
		return (
			<View style={styles.screen}>
				<Text style={styles.text}>Checking camera permission…</Text>
			</View>
		);

	const isPermissionDenied = !permission.granted;
	if (isPermissionDenied) {
		const permissionAction = permission.canAskAgain
			? requestPermission
			: Linking.openSettings;
		const permissionLabel = permission.canAskAgain
			? "Allow camera"
			: "Open settings";
		return (
			<View style={styles.screen}>
				<Text style={styles.text}>
					Pose detection runs on your device. Camera access is required for live
					detection. Local file analysis does not need it.
				</Text>
				<Button
					title="Analyze a local video"
					disabled={recordingActive}
					onPress={() => setMediaMode("video")}
				/>
				<Button title={permissionLabel} onPress={permissionAction} />
				<Button
					title="Analyze a local photo"
					disabled={recordingActive}
					onPress={() => setMediaMode("photo")}
				/>
			</View>
		);
	}

	if (recording)
		return (
			<View style={styles.screen}>
				<ReplayPanel
					notice={recordingError}
					recording={recording}
					onClose={() => setRecording(null)}
				/>
			</View>
		);

	const isCameraReady = cameraSelection !== null && isActive;
	const canToggleRecording = recordingActive || isCameraReady;
	const toggleRecording = () => {
		if (recordingActive) {
			setRecordingActive(false);
			setRecording(recorder.stop());
			return;
		}

		setRecordingError(null);
		recorder.start();
		setRecordingActive(true);
	};

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
	const resetAfterFailure = (error: InferenceError) => {
		setMetrics(null);
		feedback.reset();
		tracking.reset();
		setFailure(error);
	};
	const resetAfterConfiguration = () => {
		setMetrics(null);
		feedback.reset();
		tracking.reset();
		setFailure(null);
	};

	const pauseButtonLabel = paused ? "Resume" : "Pause";

	return (
		<View style={styles.screen}>
			<Text style={styles.title}>MediaPipe Pose</Text>
			<Button
				title="Analyze a local photo"
				disabled={recordingActive}
				onPress={() => setMediaMode("photo")}
			/>
			<Button
				title="Analyze a local video"
				disabled={recordingActive}
				onPress={() => setMediaMode("video")}
			/>
			<Text style={styles.text}>{trackingLabels[tracking.status]}</Text>
			<Text style={styles.text}>
				{feedbackLabels[feedback.statuses.raisedArm]}
			</Text>
			<Text style={styles.text}>
				Elbow feedback: {feedback.statuses.elbowBend}
			</Text>
			{cameraSelection && (
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
					onCameraConfigured={resetAfterConfiguration}
					onInferenceError={resetAfterFailure}
					skeleton={feedbackSkeleton}
				/>
			)}
			{!cameraSelection && (
				<Text style={styles.text}>
					Choose an available camera below to start.
				</Text>
			)}
			{displayedMetrics && (
				<Text style={styles.text}>
					Inference: {displayedMetrics.inferenceFps.toFixed(1)} fps · Results:{" "}
					{displayedMetrics.resultFps.toFixed(1)} fps
				</Text>
			)}
			<Button
				title={`Inference limit: ${frameLimit} fps`}
				onPress={() =>
					setFrameLimit((previous) => {
						const isPreviousSkipFifteen = previous === 15;
						return isPreviousSkipFifteen ? 30 : 15;
					})
				}
			/>
			<Button
				title={
					recordingActive
						? "Stop recording and replay"
						: "Record up to 300 landmark frames"
				}
				onPress={toggleRecording}
				disabled={!canToggleRecording}
			/>
			{failure && (
				<View>
					<Text style={styles.text}>Camera error: {failure.code}</Text>
					<Button title="Retry camera" onPress={retryCamera} />
				</View>
			)}
			<CameraControls selection={cameraSelection} onSelect={selectCamera} />
			<View style={styles.actions}>
				<Button
					title={pauseButtonLabel}
					onPress={() => setPaused((isPaused) => !isPaused)}
				/>
			</View>
		</View>
	);
};

export default App;

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
