import { Schema } from "effect";
import { requireNativeModule } from "expo";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
	validateLocalFileLocation,
} from "../pose/imageAnalysis";

import { discardResultSegmentation } from "./segmentation";

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
	const result = await native.analyzePoseImage(location, resolved);
	try {
		return Schema.decodeUnknownSync(PoseDetection)(result);
	} catch (error) {
		try {
			await discardResultSegmentation(result);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				"Image result validation and mask cleanup failed",
				{ cause: error },
			);
		}
		throw error;
	}
}
