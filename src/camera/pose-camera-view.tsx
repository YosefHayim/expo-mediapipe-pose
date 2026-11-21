import { requireNativeView } from "expo";
import { type ReactElement, type ReactNode, useState } from "react";
import {
	type LayoutChangeEvent,
	StyleSheet,
	View,
	type ViewProps,
} from "react-native";
import type { CameraFacing, PoseFrame } from "../landmarks/pose-frame";
import { readPoseFrame } from "../landmarks/pose-frame";
import type { PoseDelegate, PoseModel } from "../pose-settings";
import { readFrameRate, readPoseSettings } from "../pose-settings";
import { PoseSkeleton } from "../skeleton/pose-skeleton";
import {
	readSkeletonJointLooks,
	type SkeletonJointChoice,
	type SkeletonRendering,
} from "../skeleton/skeleton-joints";

export type PoseFailureReason =
	| "cameraPermission"
	| "modelLoad"
	| "cameraRuntime"
	| "cameraConfiguration"
	| "inferenceRuntime"
	| "nativeViewInitialization"
	| "unreadableEvent";

export interface PoseFailure {
	reason: PoseFailureReason;
}

export interface PoseCameraViewProps {
	style?: ViewProps["style"];
	isCameraRunning?: boolean;
	cameraFacing?: CameraFacing;
	poseModel?: PoseModel;
	poseDelegate?: PoseDelegate;
	maxPoseCount?: number;
	poseFrameRate?: number;
	minPoseDetectionConfidence?: number;
	minPosePresenceConfidence?: number;
	minTrackingConfidence?: number;
	skeletonRendering?: SkeletonRendering;
	skeletonColor?: string;
	skeletonJoints?: readonly SkeletonJointChoice[];
	onPoseFrame?: (poseFrame: PoseFrame) => void;
	onPoseFailure?: (failure: PoseFailure) => void;
}

interface NativePoseCameraProps {
	style?: ViewProps["style"];
	isActive: boolean;
	cameraFacing: CameraFacing;
	poseModelVariant: PoseModel;
	poseDelegate: PoseDelegate;
	maxPoses: number;
	frameLimit: number;
	callbackFps: number;
	previewFps: number;
	minPoseDetectionConfidence: number;
	minPosePresenceConfidence: number;
	minTrackingConfidence: number;
	onLandmark: (landmarkEvent: { nativeEvent: unknown }) => void;
	onInferenceError: (errorEvent: { nativeEvent: unknown }) => void;
}

const NativePoseCamera = loadNativePoseCamera();

export function PoseCameraView({
	style,
	isCameraRunning = true,
	cameraFacing = "front",
	poseModel = "full",
	poseDelegate = "gpu",
	maxPoseCount = 1,
	poseFrameRate = 30,
	minPoseDetectionConfidence = 0.5,
	minPosePresenceConfidence = 0.5,
	minTrackingConfidence = 0.5,
	skeletonRendering = "shown",
	skeletonColor = "#38bdf8",
	skeletonJoints = [],
	onPoseFrame,
	onPoseFailure,
}: PoseCameraViewProps): ReactElement {
	const checkedFrameRate = readFrameRate(poseFrameRate);
	const poseSettings = readPoseSettings({
		poseModel,
		poseDelegate,
		maxPoseCount,
		minPoseDetectionConfidence,
		minPosePresenceConfidence,
		minTrackingConfidence,
	});
	const [viewSize, setViewSize] = useState({ width: 0, height: 0 });
	const [drawnFrame, setDrawnFrame] = useState<PoseFrame | null>(null);

	function reportFrame(nextFrame: PoseFrame) {
		const isListenerMissing = onPoseFrame == null;

		if (isListenerMissing) return;

		onPoseFrame(nextFrame);
	}

	function reportFailure(reason: PoseFailureReason) {
		const isListenerMissing = onPoseFailure == null;

		if (isListenerMissing) return;

		onPoseFailure({ reason });
	}

	function handleLayout(layoutEvent: LayoutChangeEvent) {
		setViewSize({
			width: layoutEvent.nativeEvent.layout.width,
			height: layoutEvent.nativeEvent.layout.height,
		});
	}

	function handleLandmark(landmarkEvent: { nativeEvent: unknown }) {
		const nextFrame = readPoseFrame(landmarkEvent.nativeEvent);
		const isUnreadable = nextFrame == null;

		if (isUnreadable) {
			reportFailure("unreadableEvent");
			return;
		}

		reportFrame(nextFrame);

		const isSkeletonShown = skeletonRendering == "shown";

		if (isSkeletonShown) setDrawnFrame(nextFrame);
	}

	function handleInferenceError(errorEvent: { nativeEvent: unknown }) {
		const reason = readPoseFailureReason(errorEvent.nativeEvent);
		const isReasonMissing = reason == null;

		if (isReasonMissing) {
			reportFailure("unreadableEvent");
			return;
		}

		reportFailure(reason);
	}

	const previewFrameRate = 30;

	readSkeletonJointLooks(skeletonJoints, skeletonColor);

	const skeleton = showSkeleton({
		skeletonRendering,
		drawnFrame,
		viewWidth: viewSize.width,
		viewHeight: viewSize.height,
		skeletonColor,
		skeletonJoints,
	});

	return (
		<View style={style} onLayout={handleLayout}>
			<NativePoseCamera
				style={styles.camera}
				isActive={isCameraRunning}
				cameraFacing={cameraFacing}
				poseModelVariant={poseSettings.poseModel}
				poseDelegate={poseSettings.poseDelegate}
				maxPoses={poseSettings.maxPoseCount}
				frameLimit={checkedFrameRate}
				callbackFps={checkedFrameRate}
				previewFps={previewFrameRate}
				minPoseDetectionConfidence={poseSettings.minPoseDetectionConfidence}
				minPosePresenceConfidence={poseSettings.minPosePresenceConfidence}
				minTrackingConfidence={poseSettings.minTrackingConfidence}
				onLandmark={handleLandmark}
				onInferenceError={handleInferenceError}
			/>
			{skeleton}
		</View>
	);
}

interface ShownSkeleton {
	skeletonRendering: SkeletonRendering;
	drawnFrame: PoseFrame | null;
	viewWidth: number;
	viewHeight: number;
	skeletonColor: string;
	skeletonJoints: readonly SkeletonJointChoice[];
}

function showSkeleton(shown: ShownSkeleton): ReactNode {
	const isHidden = shown.skeletonRendering == "hidden";

	if (isHidden) return null;

	const drawnFrame = shown.drawnFrame;
	const isFrameMissing = drawnFrame == null;

	if (isFrameMissing) return null;

	const isWidthEmpty = shown.viewWidth <= 0;

	if (isWidthEmpty) return null;

	const isHeightEmpty = shown.viewHeight <= 0;

	if (isHeightEmpty) return null;

	return (
		<View style={styles.skeleton} pointerEvents="none">
			<PoseSkeleton
				poseFrame={drawnFrame}
				viewWidth={shown.viewWidth}
				viewHeight={shown.viewHeight}
				skeletonColor={shown.skeletonColor}
				skeletonJoints={shown.skeletonJoints}
			/>
		</View>
	);
}

function loadNativePoseCamera() {
	try {
		return requireNativeView<NativePoseCameraProps>("ExpoMediaPipePose");
	} catch (error) {
		throw new Error(
			"This needs a development build. Expo Go cannot load the pose camera.",
			{ cause: error },
		);
	}
}

function readPoseFailureReason(nativeEvent: unknown): PoseFailureReason | null {
	const isEvent = isPlainObject(nativeEvent);

	if (!isEvent) return null;

	return readFailureCode(nativeEvent["code"]);
}

function readFailureCode(code: unknown): PoseFailureReason | null {
	const isCameraPermission = code == "cameraPermission";

	if (isCameraPermission) return "cameraPermission";

	const isModelLoad = code == "modelInitialization";

	if (isModelLoad) return "modelLoad";

	const isModelLoadName = code == "modelLoad";

	if (isModelLoadName) return "modelLoad";

	const isCameraRuntime = code == "cameraRuntime";

	if (isCameraRuntime) return "cameraRuntime";

	const isCameraConfiguration = code == "cameraConfiguration";

	if (isCameraConfiguration) return "cameraConfiguration";

	const isInferenceRuntime = code == "inferenceRuntime";

	if (isInferenceRuntime) return "inferenceRuntime";

	const isNativeViewInitialization = code == "nativeViewInitialization";

	if (isNativeViewInitialization) return "nativeViewInitialization";

	const isUnreadable = code == "invalidNativeEvent";

	if (isUnreadable) return "unreadableEvent";

	const isUnreadableName = code == "unreadableEvent";

	if (isUnreadableName) return "unreadableEvent";

	return null;
}

function isPlainObject(
	candidate: unknown,
): candidate is Record<string, unknown> {
	const isObject = typeof candidate == "object";

	if (!isObject) return false;

	const isNull = candidate == null;

	if (isNull) return false;

	const isArray = Array.isArray(candidate);

	if (isArray) return false;

	return true;
}

const styles = StyleSheet.create({
	camera: { flex: 1 },
	skeleton: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});
