import { requireNativeModule } from "expo";
import { discardReportSegmentation } from "../segmentation/native";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
	validateLocalFileLocation,
} from "./analysis";

export const analyzePoseImage = async (
	location: string,
	imageSettings: PoseImageOptions = {},
): Promise<PoseDetection> => {
	validateLocalFileLocation(location);
	const checkedSettings = resolvePoseImageOptions(imageSettings);
	const native = requireNativeModule<{
		analyzePoseImage(
			location: string,
			checkedSettings: ReturnType<typeof resolvePoseImageOptions>,
		): Promise<unknown>;
	}>("ExpoMediaPipePose");
	const analysis = await native.analyzePoseImage(location, checkedSettings);
	try {
		return PoseDetection.parse(analysis);
	} catch (error) {
		try {
			await discardReportSegmentation(analysis);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				"Image result validation and mask cleanup failed",
				{ cause: error },
			);
		}
		throw error;
	}
};
