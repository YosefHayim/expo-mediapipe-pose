import { requireNativeModule } from "expo";
import type { NativePoseImageSettings } from "./pose-settings";

export interface PoseNativeModule {
	analyzePoseImage(
		location: string,
		settings: NativePoseImageSettings,
	): Promise<unknown>;
	openPoseVideo(
		location: string,
		settings: NativePoseImageSettings,
		trackingConfidence: number,
	): Promise<unknown>;
	readPoseVideoFrame(id: string, timestampMs: number): Promise<unknown>;
	closePoseVideo(id: string): Promise<void>;
	requestCameraPermission(): Promise<string>;
}

export function loadPoseModule(): PoseNativeModule {
	try {
		return requireNativeModule<PoseNativeModule>("ExpoMediaPipePose");
	} catch (error) {
		throw new Error(
			"This needs a development build. Expo Go cannot load the pose camera.",
			{ cause: error },
		);
	}
}
