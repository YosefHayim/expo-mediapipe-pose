import * as React from "react";
import type { ViewProps } from "react-native";
import { Either, Schema } from "effect";
import { requireNativeView } from "expo";

import {
	CameraConfiguration,
	CameraFacing,
	CameraLens,
	InferenceError,
	ModelVariant,
	PoseFrame,
} from "./contracts";

export interface PoseCameraViewProps extends ViewProps {
	cameraFacing?: Schema.Schema.Type<typeof CameraFacing>;
	cameraLens?: Schema.Schema.Type<typeof CameraLens>;
	cameraZoomFactor?: number;
	frameLimit?: number;
	poseModelAssetPath?: string | null;
	poseModelVariant?: Schema.Schema.Type<typeof ModelVariant>;
	onCameraConfigured?: (configuration: CameraConfiguration) => void;
	onInferenceError?: (failure: InferenceError) => void;
	onLandmark: (frame: PoseFrame) => void;
}

interface NativeCameraProps
	extends Omit<
		PoseCameraViewProps,
		"onCameraConfigured" | "onInferenceError" | "onLandmark"
	> {
	onCameraConfigured: (event: { nativeEvent: unknown }) => void;
	onInferenceError: (event: { nativeEvent: unknown }) => void;
	onLandmark: (event: { nativeEvent: unknown }) => void;
}

const NativeCamera = requireNativeView<NativeCameraProps>("OlyPoseCamera");
const decodeFrame = Schema.decodeUnknownEither(PoseFrame);
const decodeConfiguration = Schema.decodeUnknownEither(CameraConfiguration);
const decodeFailure = Schema.decodeUnknownEither(InferenceError);

export const PoseCameraView = ({
	onCameraConfigured,
	onInferenceError,
	onLandmark,
	...cameraProps
}: PoseCameraViewProps) => {
	const handleFrame = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			const decodedFrame = decodeFrame(event.nativeEvent);
			if (Either.isLeft(decodedFrame)) {
				onInferenceError?.({ code: "inferenceRuntime" });
				return;
			}
			onLandmark(decodedFrame.right);
		},
		[onInferenceError, onLandmark],
	);

	const handleConfiguration = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			const decodedConfiguration = decodeConfiguration(event.nativeEvent);
			if (Either.isLeft(decodedConfiguration)) {
				onInferenceError?.({ code: "cameraConfiguration" });
				return;
			}
			onCameraConfigured?.(decodedConfiguration.right);
		},
		[onCameraConfigured, onInferenceError],
	);

	const handleFailure = React.useCallback(
		(event: { nativeEvent: unknown }) => {
			const decodedFailure = decodeFailure(event.nativeEvent);
			onInferenceError?.(
				Either.isRight(decodedFailure)
					? decodedFailure.right
					: { code: "inferenceRuntime" },
			);
		},
		[onInferenceError],
	);

	return (
		<NativeCamera
			{...cameraProps}
			onLandmark={handleFrame}
			onCameraConfigured={handleConfiguration}
			onInferenceError={handleFailure}
		/>
	);
};
