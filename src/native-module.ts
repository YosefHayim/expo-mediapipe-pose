import { requireNativeModule } from "expo";
import type { resolvePoseImageOptions } from "./file-analysis/file-analysis-options";

interface ExpoMediaPipePoseModule {
	getCameraCapabilities(): Promise<unknown>;
	releasePosePersonMask(id: string): Promise<void>;
	analyzePoseImage(
		location: string,
		checkedSettings: ReturnType<typeof resolvePoseImageOptions>,
	): Promise<unknown>;
	openPoseVideo(
		location: string,
		settings: ReturnType<typeof resolvePoseImageOptions>,
		trackingConfidence: number,
	): Promise<unknown>;
	readPoseVideoFrame(id: string, timestampMs: number): Promise<unknown>;
	closePoseVideo(id: string): Promise<void>;
}

export function getNativeModule() {
	return requireNativeModule<ExpoMediaPipePoseModule>("ExpoMediaPipePose");
}
