import { requireNativeModule } from "expo";
import { discardResultSegmentation } from "../segmentation/native";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
	validateLocalFileLocation,
} from "./analysis";

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
		return PoseDetection.parse(result);
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
