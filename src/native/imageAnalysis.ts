import { Schema } from "effect";
import { requireNativeModule } from "expo";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
	validateLocalFileLocation,
} from "../pose/imageAnalysis";

export async function analyzePoseImage(
	location: string,
	options: PoseImageOptions = {},
): Promise<PoseDetection> {
	validateLocalFileLocation(location);
	const resolved = resolvePoseImageOptions(options);
	const native = requireNativeModule<{
		analyzePoseImage(
			location: string,
			options: ReturnType<typeof resolvePoseImageOptions>,
		): Promise<unknown>;
	}>("ExpoMediaPipePose");
	return Schema.decodeUnknownSync(PoseDetection)(
		await native.analyzePoseImage(location, resolved),
	);
}
