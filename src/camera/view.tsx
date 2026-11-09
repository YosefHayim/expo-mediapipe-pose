import { requireNativeView } from "expo";
import * as React from "react";
import {
	type LayoutChangeEvent,
	StyleSheet,
	View,
	type ViewProps,
} from "react-native";
import type { z } from "zod";
import {
	CameraConfiguration,
	type CameraFacing,
	type CameraLens,
	InferenceError,
	MaxPoses,
	type ModelVariant,
	PoseFrame,
	PosePerformanceMetrics,
} from "../contracts";
import { MaskMaxDimension } from "../segmentation/mask";
import { discardResultSegmentation } from "../segmentation/native";
import type { SkeletonOptions } from "../skeleton/logic";
import { PoseSkeleton } from "../skeleton/view";
import { getOverlayStaleAfterMs } from "./frame-rates";
import { usePoseOverlayFrame } from "./use-overlay-frame";

interface CameraOptions {
	isActive?: boolean;
	cameraFacing?: z.infer<typeof CameraFacing>;
	cameraLens?: z.infer<typeof CameraLens>;
	cameraZoomFactor?: number;
	frameLimit?: number;
	previewFps?: number;
	callbackFps?: number;
	poseModelAssetPath?: string | null;
	poseModelVariant?: z.infer<typeof ModelVariant>;
	minPoseDetectionConfidence?: number;
	minPosePresenceConfidence?: number;
	minTrackingConfidence?: number;
	maxPoses?: number;
	segmentationEnabled?: boolean;
	maskMaxDimension?: number;
}

export interface PoseCameraViewProps extends ViewProps, CameraOptions {
	skeleton?: boolean | SkeletonOptions;
	onCameraConfigured?: (configuration: CameraConfiguration) => void;
	onInferenceError?: (failure: InferenceError) => void;
	onLandmark?: (frame: PoseFrame) => void;
	onPerformanceMetrics?: (metrics: PosePerformanceMetrics) => void;
}

interface NativeCameraProps extends ViewProps, CameraOptions {
	performanceMetricsEnabled: boolean;
	onPerformanceMetrics: (event: { nativeEvent: unknown }) => void;
	onCameraConfigured: (event: { nativeEvent: unknown }) => void;
	onInferenceError: (event: { nativeEvent: unknown }) => void;
	onLandmark: (event: { nativeEvent: unknown }) => void;
}

const NativeCamera = requireNativeView<NativeCameraProps>("ExpoMediaPipePose");
const decodeFrame = (candidateNativeEvent: unknown) =>
	PoseFrame.safeParse(candidateNativeEvent);
const decodeConfiguration = (candidateNativeEvent: unknown) =>
	CameraConfiguration.safeParse(candidateNativeEvent);
const decodeFailure = (candidateNativeEvent: unknown) =>
	InferenceError.safeParse(candidateNativeEvent);
const decodeMetrics = (candidateNativeEvent: unknown) =>
	PosePerformanceMetrics.safeParse(candidateNativeEvent);
const styles = StyleSheet.create({
	container: { overflow: "hidden" },
	overlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
});

export const PoseCameraView = ({
	isActive = true,
	cameraFacing = "front",
	cameraLens = "auto",
	cameraZoomFactor = 1,
	frameLimit = 30,
	previewFps = 30,
	callbackFps = 30,
	poseModelVariant = "full",
	poseModelAssetPath = null,
	minPoseDetectionConfidence = 0.35,
	minPosePresenceConfidence = 0.35,
	minTrackingConfidence = 0.35,
	maxPoses = 1,
	segmentationEnabled = false,
	maskMaxDimension = 256,
	skeleton = true,
	onCameraConfigured,
	onInferenceError,
	onLandmark,
	onPerformanceMetrics,
	style,
	onLayout,
	children,
	...viewProps
}: PoseCameraViewProps) => {
	MaxPoses.parse(maxPoses);
	MaskMaxDimension.parse(maskMaxDimension);

	const isSegmentationEnabledAndOnLandmarkMissing =
		segmentationEnabled && !onLandmark;
	if (isSegmentationEnabledAndOnLandmarkMissing)
		throw new Error(
			"Segmentation requires an onLandmark consumer to release mask handles",
		);

	const overlayStaleAfterMs = getOverlayStaleAfterMs({
		frameLimit,
		previewFps,
		callbackFps,
	});
	const {
		frame,
		update: updateOverlay,
		clear,
	} = usePoseOverlayFrame(overlayStaleAfterMs);
	const [size, setSize] = React.useState({ width: 0, height: 0 });

	const captureIdentity = JSON.stringify({
		isActive,
		cameraFacing,
		cameraLens,
		cameraZoomFactor,
		previewFps,
		poseModelVariant,
		poseModelAssetPath,
		minPoseDetectionConfidence,
		minPosePresenceConfidence,
		minTrackingConfidence,
		maxPoses,
		segmentationEnabled,
		maskMaxDimension,
	});
	const previousCaptureIdentity = React.useRef(captureIdentity);
	React.useLayoutEffect(() => {
		const isCaptureIdentityChanged =
			previousCaptureIdentity.current !== captureIdentity;
		if (isCaptureIdentityChanged) {
			previousCaptureIdentity.current = captureIdentity;
			clear();
		}
	}, [captureIdentity, clear]);

	const skeletonEnabled = skeleton !== false;
	React.useLayoutEffect(() => {
		const isSkeletonEnabledMissing = !skeletonEnabled;
		if (isSkeletonEnabledMissing) clear();
	}, [skeletonEnabled, clear]);
	const isActiveAndSkeletonEnabled = isActive && skeletonEnabled;
	const skeletonFrame = isActiveAndSkeletonEnabled ? frame : null;
	const isSkeletonTypeObject = typeof skeleton === "object";
	const skeletonOptions = isSkeletonTypeObject ? skeleton : {};

	const handleFrame = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			const discard = () => {
				void discardResultSegmentation(event.nativeEvent).catch(() =>
					onInferenceError?.({ code: "segmentationCleanup" }),
				);
			};

			const isIsActiveMissing = !isActive;
			if (isIsActiveMissing) {
				discard();
				return;
			}

			const decoded = decodeFrame(event.nativeEvent);

			const isDecodeInvalid = !decoded.success;
			if (isDecodeInvalid) {
				clear();
				discard();
				onInferenceError?.({ code: "invalidNativeEvent" });
				return;
			}

			if (skeletonEnabled) {
				updateOverlay(decoded.data);
			}

			const isOnLandmarkMissing = !onLandmark;
			if (isOnLandmarkMissing) {
				discard();
				return;
			}

			try {
				onLandmark(decoded.data);
			} catch (error) {
				discard();
				throw error;
			}
		},
		[
			isActive,
			skeletonEnabled,
			clear,
			onInferenceError,
			onLandmark,
			updateOverlay,
		],
	);
	const handleMetrics = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			const isIsActiveMissing = !isActive;
			if (isIsActiveMissing) return;

			const decoded = decodeMetrics(event.nativeEvent);

			const isDecodeInvalid = !decoded.success;
			if (isDecodeInvalid) {
				onInferenceError?.({ code: "invalidNativeEvent" });
				return;
			}

			onPerformanceMetrics?.(decoded.data);
		},
		[isActive, onInferenceError, onPerformanceMetrics],
	);

	const handleConfiguration = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			clear();
			const decoded = decodeConfiguration(event.nativeEvent);

			const isDecodeInvalid = !decoded.success;
			if (isDecodeInvalid) {
				onInferenceError?.({ code: "invalidNativeEvent" });
				return;
			}

			onCameraConfigured?.(decoded.data);
		},
		[clear, onCameraConfigured, onInferenceError],
	);

	const handleFailure = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			clear();
			const decodedFailure = decodeFailure(event.nativeEvent);

			const isFailureInvalid = !decodedFailure.success;
			if (isFailureInvalid) {
				onInferenceError?.({ code: "invalidNativeEvent" });
				return;
			}

			onInferenceError?.(decodedFailure.data);
		},
		[clear, onInferenceError],
	);

	const handleLayout = React.useCallback(
		(event: LayoutChangeEvent) => {
			const { width, height } = event.nativeEvent.layout;
			setSize((previous) => {
				const sizeUnchanged =
					previous.width === width && previous.height === height;
				if (sizeUnchanged) return previous;

				return { width, height };
			});
			onLayout?.(event);
		},
		[onLayout],
	);

	return (
		<View
			{...viewProps}
			style={[styles.container, style]}
			onLayout={handleLayout}
		>
			<NativeCamera
				style={StyleSheet.absoluteFill}
				isActive={isActive}
				cameraFacing={cameraFacing}
				cameraLens={cameraLens}
				cameraZoomFactor={cameraZoomFactor}
				frameLimit={frameLimit}
				previewFps={previewFps}
				callbackFps={callbackFps}
				performanceMetricsEnabled={onPerformanceMetrics !== undefined}
				onPerformanceMetrics={handleMetrics}
				poseModelVariant={poseModelVariant}
				poseModelAssetPath={poseModelAssetPath}
				minPoseDetectionConfidence={minPoseDetectionConfidence}
				minPosePresenceConfidence={minPosePresenceConfidence}
				minTrackingConfidence={minTrackingConfidence}
				maxPoses={maxPoses}
				segmentationEnabled={segmentationEnabled}
				maskMaxDimension={maskMaxDimension}
				onLandmark={handleFrame}
				onCameraConfigured={handleConfiguration}
				onInferenceError={handleFailure}
			/>
			{skeletonFrame && (
				<View style={styles.overlay} pointerEvents="none">
					<PoseSkeleton {...skeletonOptions} frame={skeletonFrame} {...size} />
				</View>
			)}
			{children}
		</View>
	);
};
