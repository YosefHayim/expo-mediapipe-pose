import { Either, Schema } from "effect";
import { requireNativeView } from "expo";
import * as React from "react";
import {
	type LayoutChangeEvent,
	StyleSheet,
	View,
	type ViewProps,
} from "react-native";
import {
	CameraConfiguration,
	type CameraFacing,
	type CameraLens,
	InferenceError,
	type ModelVariant,
	PoseFrame,
} from "../contracts";
import type { SkeletonOptions } from "../pose/skeleton";
import { PoseSkeleton } from "./PoseSkeleton";

interface CameraOptions {
	isActive?: boolean;
	cameraFacing?: Schema.Schema.Type<typeof CameraFacing>;
	cameraLens?: Schema.Schema.Type<typeof CameraLens>;
	cameraZoomFactor?: number;
	frameLimit?: number;
	poseModelAssetPath?: string | null;
	poseModelVariant?: Schema.Schema.Type<typeof ModelVariant>;
	minPoseDetectionConfidence?: number;
	minPosePresenceConfidence?: number;
	minTrackingConfidence?: number;
}

export interface PoseCameraViewProps extends ViewProps, CameraOptions {
	skeleton?: boolean | SkeletonOptions;
	onCameraConfigured?: (configuration: CameraConfiguration) => void;
	onInferenceError?: (failure: InferenceError) => void;
	onLandmark?: (frame: PoseFrame) => void;
}

interface NativeCameraProps extends ViewProps, CameraOptions {
	onCameraConfigured: (event: { nativeEvent: unknown }) => void;
	onInferenceError: (event: { nativeEvent: unknown }) => void;
	onLandmark: (event: { nativeEvent: unknown }) => void;
}

const NativeCamera = requireNativeView<NativeCameraProps>("ExpoMediaPipePose");
const decodeFrame = Schema.decodeUnknownEither(PoseFrame);
const decodeConfiguration = Schema.decodeUnknownEither(CameraConfiguration);
const decodeFailure = Schema.decodeUnknownEither(InferenceError);
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
	poseModelVariant = "full",
	poseModelAssetPath = null,
	minPoseDetectionConfidence = 0.35,
	minPosePresenceConfidence = 0.35,
	minTrackingConfidence = 0.35,
	skeleton = true,
	onCameraConfigured,
	onInferenceError,
	onLandmark,
	style,
	onLayout,
	children,
	...viewProps
}: PoseCameraViewProps) => {
	const [frame, setFrame] = React.useState<PoseFrame | null>(null);
	const [size, setSize] = React.useState({ width: 0, height: 0 });
	const staleTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);
	const clear = React.useCallback(() => {
		clearTimeout(staleTimer.current);
		setFrame(null);
	}, []);

	const captureIdentity = JSON.stringify({
		isActive,
		cameraFacing,
		cameraLens,
		cameraZoomFactor,
		frameLimit,
		poseModelVariant,
		poseModelAssetPath,
		minPoseDetectionConfidence,
		minPosePresenceConfidence,
		minTrackingConfidence,
	});
	const previousCaptureIdentity = React.useRef(captureIdentity);
	React.useLayoutEffect(() => {
		if (previousCaptureIdentity.current !== captureIdentity) {
			previousCaptureIdentity.current = captureIdentity;
			clear();
		}
		return () => {
			clearTimeout(staleTimer.current);
		};
	}, [captureIdentity, clear]);

	const skeletonEnabled = skeleton !== false;
	const skeletonFrame = isActive && skeletonEnabled ? frame : null;
	const skeletonOptions = typeof skeleton === "object" ? skeleton : {};

	const handleFrame = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			if (!isActive) return;
			const decoded = decodeFrame(event.nativeEvent);
			if (Either.isLeft(decoded)) {
				clear();
				onInferenceError?.({ code: "invalidNativeEvent" });
				return;
			}
			if (skeletonEnabled) {
				setFrame(decoded.right);
				clearTimeout(staleTimer.current);
				staleTimer.current = setTimeout(clear, 500);
			}
			onLandmark?.(decoded.right);
		},
		[isActive, skeletonEnabled, clear, onInferenceError, onLandmark],
	);

	const handleConfiguration = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			clear();
			const decoded = decodeConfiguration(event.nativeEvent);
			if (Either.isLeft(decoded)) {
				onInferenceError?.({ code: "invalidNativeEvent" });
				return;
			}
			onCameraConfigured?.(decoded.right);
		},
		[clear, onCameraConfigured, onInferenceError],
	);

	const handleFailure = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			clear();
			const decoded = decodeFailure(event.nativeEvent);
			onInferenceError?.(
				Either.isRight(decoded)
					? decoded.right
					: { code: "invalidNativeEvent" },
			);
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
				poseModelVariant={poseModelVariant}
				poseModelAssetPath={poseModelAssetPath}
				minPoseDetectionConfidence={minPoseDetectionConfidence}
				minPosePresenceConfidence={minPosePresenceConfidence}
				minTrackingConfidence={minTrackingConfidence}
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
