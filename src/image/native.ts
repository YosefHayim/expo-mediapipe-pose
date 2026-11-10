import { requireNativeModule } from "expo";
import { discardResultSegmentation } from "../segmentation/native";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
	validateLocalFileLocation,
} from "./analysis";

export const analyzePoseImage = async (
	location: string,
	imageOptions: PoseImageOptions = {},
): Promise<PoseDetection> => {
	validateLocalFileLocation(location);
	const checkedOptions = resolvePoseImageOptions(imageOptions);
	const native = requireNativeModule<{
		analyzePoseImage(
			location: string,
			checkedOptions: ReturnType<typeof resolvePoseImageOptions>,
		): Promise<unknown>;
	}>("ExpoMediaPipePose");
	const analysis = await native.analyzePoseImage(location, checkedOptions);
	try {
		return PoseDetection.parse(analysis);
	} catch (error) {
		try {
			await discardResultSegmentation(analysis);
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
