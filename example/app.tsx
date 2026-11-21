import { registerRootComponent } from "expo";
import {
	type PoseCamera,
	PoseCameraView,
	type PoseFailure,
	type PoseFrame,
	type PoseModel,
	type SkeletonJointChoice,
	usePoseCamera,
} from "expo-mediapipe-pose";
import { lazy, type ReactElement, Suspense, useState } from "react";
import {
	Button,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	View,
} from "react-native";

const WebPoseScreen = lazy(loadWebPoseScreen);

export function App(): ReactElement {
	const isBrowser = Platform.OS == "web";

	if (isBrowser) {
		return (
			<Suspense fallback={null}>
				<WebPoseScreen />
			</Suspense>
		);
	}

	return <PhonePoseScreen />;
}

function loadWebPoseScreen(): Promise<{
	default: typeof import("./web-pose-screen").WebPoseScreen;
}> {
	return import("./web-pose-screen").then(pickWebPoseScreen);
}

function pickWebPoseScreen(webPoseModule: typeof import("./web-pose-screen")) {
	return { default: webPoseModule.WebPoseScreen };
}

const POSE_MODELS: PoseModel[] = ["lite", "full", "heavy"];
const FRAME_RATES = [15, 30, 60];
const ARM_SKELETON_JOINTS: SkeletonJointChoice[] = [
	{ landmarkName: "leftShoulder", color: "#f97316" },
	{ landmarkName: "leftElbow", color: "#f97316" },
	{ landmarkName: "rightShoulder", color: "#f97316" },
	{ landmarkName: "rightElbow", color: "#f97316" },
];

function PhonePoseScreen(): ReactElement {
	const [poseModel, setPoseModel] = useState<PoseModel>("full");
	const [poseFrameRate, setPoseFrameRate] = useState(30);
	const camera = usePoseCamera({
		poseModel,
		poseFrameRate,
		skeletonJoints: ARM_SKELETON_JOINTS,
	});

	function handleChoosePoseModel(nextModel: PoseModel) {
		setPoseModel(nextModel);
	}

	function handleChooseFrameRate(nextFrameRate: number) {
		setPoseFrameRate(nextFrameRate);
	}

	function showModel(model: PoseModel) {
		return (
			<ModelChoice
				key={model}
				poseModel={model}
				chosenPoseModel={poseModel}
				onChoosePoseModel={handleChoosePoseModel}
			/>
		);
	}

	function showFrameRate(frameRate: number) {
		return (
			<FrameRateChoice
				key={frameRate}
				frameRate={frameRate}
				chosenFrameRate={poseFrameRate}
				onChooseFrameRate={handleChooseFrameRate}
			/>
		);
	}

	const isClosed = camera.permission != "granted";

	if (isClosed) {
		return (
			<View style={styles.screen}>
				<Text style={styles.note}>{readPermissionNote(camera.permission)}</Text>
				<Text style={styles.note}>{readFailureNote(camera.failure)}</Text>
				<Button title="Allow camera" onPress={camera.askForCamera} />
			</View>
		);
	}

	return (
		<View style={styles.screen}>
			<PoseCameraView
				style={styles.camera}
				isCameraRunning={camera.isCameraRunning}
				cameraFacing={camera.cameraFacing}
				poseModel={camera.poseModel}
				poseDelegate={camera.poseDelegate}
				maxPoseCount={camera.maxPoseCount}
				poseFrameRate={camera.poseFrameRate}
				minPoseDetectionConfidence={camera.minPoseDetectionConfidence}
				minPosePresenceConfidence={camera.minPosePresenceConfidence}
				minTrackingConfidence={camera.minTrackingConfidence}
				skeletonRendering={camera.skeletonRendering}
				skeletonColor={camera.skeletonColor}
				skeletonJoints={camera.skeletonJoints}
				onPoseFrame={camera.readFrame}
				onPoseFailure={camera.readFailure}
			/>
			<View style={styles.bar}>{POSE_MODELS.map(showModel)}</View>
			<View style={styles.bar}>{FRAME_RATES.map(showFrameRate)}</View>
			<Text style={styles.note}>{readWristNote(camera.frame)}</Text>
			<Text style={styles.note}>{readFailureNote(camera.failure)}</Text>
		</View>
	);
}

interface ModelChoiceProps {
	poseModel: PoseModel;
	chosenPoseModel: PoseModel;
	onChoosePoseModel: (nextModel: PoseModel) => void;
}

function ModelChoice({
	poseModel,
	chosenPoseModel,
	onChoosePoseModel,
}: ModelChoiceProps) {
	function handlePress() {
		onChoosePoseModel(poseModel);
	}

	const isChosen = poseModel == chosenPoseModel;
	const label = isChosen ? `${poseModel} on` : poseModel;

	return (
		<Pressable onPress={handlePress} style={styles.choice}>
			<Text style={styles.choiceLabel}>{label}</Text>
		</Pressable>
	);
}

interface FrameRateChoiceProps {
	frameRate: number;
	chosenFrameRate: number;
	onChooseFrameRate: (nextFrameRate: number) => void;
}

function FrameRateChoice({
	frameRate,
	chosenFrameRate,
	onChooseFrameRate,
}: FrameRateChoiceProps) {
	function handlePress() {
		onChooseFrameRate(frameRate);
	}

	const isChosen = frameRate == chosenFrameRate;
	const label = isChosen ? `${frameRate} fps on` : `${frameRate} fps`;

	return (
		<Pressable onPress={handlePress} style={styles.choice}>
			<Text style={styles.choiceLabel}>{label}</Text>
		</Pressable>
	);
}

function readPermissionNote(permission: PoseCamera["permission"]): string {
	const isDenied = permission == "denied";

	if (isDenied) return "Camera permission was denied.";

	return "The pose camera needs permission.";
}

function readWristNote(poseFrame: PoseFrame | null): string {
	const isMissing = poseFrame == null;

	if (isMissing) return "No pose yet.";

	const leftWrist = poseFrame.landmarks.leftWrist;
	const isWristMissing = leftWrist == null;

	if (isWristMissing) return "Left wrist is not visible.";

	return `Left wrist ${leftWrist.x.toFixed(2)}, ${leftWrist.y.toFixed(2)}`;
}

function readFailureNote(failure: PoseFailure | null): string {
	const isMissing = failure == null;

	if (isMissing) return "";

	return failure.reason;
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#09090b" },
	camera: { flex: 1 },
	bar: { flexDirection: "row", gap: 8, padding: 8 },
	choice: { paddingVertical: 8, paddingHorizontal: 12 },
	choiceLabel: { color: "#fafafa", fontSize: 16 },
	note: { color: "#fafafa", paddingHorizontal: 12, paddingBottom: 8 },
});

registerRootComponent(App);
