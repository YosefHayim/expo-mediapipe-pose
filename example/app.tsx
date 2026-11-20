import {
	PoseCameraView,
	type PoseFailure,
	type PoseFrame,
	type PoseModel,
	requestCameraPermission,
} from "expo-mediapipe-pose";
import { useState } from "react";
import { Button, Pressable, StyleSheet, Text, View } from "react-native";

const POSE_MODELS: PoseModel[] = ["lite", "full", "heavy"];
const FRAME_RATES = [15, 30, 60];

type CameraPermission = "unknown" | "granted" | "denied";

export function App() {
	const [cameraPermission, setCameraPermission] =
		useState<CameraPermission>("unknown");
	const [poseModel, setPoseModel] = useState<PoseModel>("full");
	const [poseFrameRate, setPoseFrameRate] = useState(30);
	const [poseFrame, setPoseFrame] = useState<PoseFrame | null>(null);
	const [failureReason, setFailureReason] = useState<string | null>(null);

	async function handleAllowPress() {
		try {
			const permission = await requestCameraPermission();
			setCameraPermission(permission);
		} catch (error) {
			setFailureReason("The camera permission dialog failed.");
			console.error({ error });
		}
	}

	function handlePoseFrame(nextFrame: PoseFrame) {
		setPoseFrame(nextFrame);
		setFailureReason(null);
	}

	function handlePoseFailure(failure: PoseFailure) {
		setFailureReason(failure.reason);
	}

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

	const isPermissionGranted = cameraPermission === "granted";

	if (!isPermissionGranted) {
		return (
			<View style={styles.screen}>
				<Text style={styles.note}>{readPermissionNote(cameraPermission)}</Text>
				<Button title="Allow camera" onPress={handleAllowPress} />
			</View>
		);
	}

	return (
		<View style={styles.screen}>
			<PoseCameraView
				style={styles.camera}
				poseModel={poseModel}
				poseFrameRate={poseFrameRate}
				onPoseFrame={handlePoseFrame}
				onPoseFailure={handlePoseFailure}
			/>
			<View style={styles.bar}>{POSE_MODELS.map(showModel)}</View>
			<View style={styles.bar}>{FRAME_RATES.map(showFrameRate)}</View>
			<Text style={styles.note}>{readWristNote(poseFrame)}</Text>
			<Text style={styles.note}>{readFailureNote(failureReason)}</Text>
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

	const isChosen = poseModel === chosenPoseModel;
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

	const isChosen = frameRate === chosenFrameRate;
	const label = isChosen ? `${frameRate} fps on` : `${frameRate} fps`;

	return (
		<Pressable onPress={handlePress} style={styles.choice}>
			<Text style={styles.choiceLabel}>{label}</Text>
		</Pressable>
	);
}

function readPermissionNote(cameraPermission: CameraPermission): string {
	const isDenied = cameraPermission === "denied";

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

function readFailureNote(failureReason: string | null): string {
	const isMissing = failureReason == null;

	if (isMissing) return "";

	return failureReason;
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#09090b" },
	camera: { flex: 1 },
	bar: { flexDirection: "row", gap: 8, padding: 8 },
	choice: { paddingVertical: 8, paddingHorizontal: 12 },
	choiceLabel: { color: "#fafafa", fontSize: 16 },
	note: { color: "#fafafa", paddingHorizontal: 12, paddingBottom: 8 },
});
