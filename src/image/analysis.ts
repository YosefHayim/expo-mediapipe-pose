import { z } from "zod";
import {
	createLandmarkSchema,
	createObjectSchema,
	createPoseResultsSchema,
	MaxPoses,
	ModelVariant,
} from "../contracts";
import { MaskMaxDimension, PoseSegmentation } from "../segmentation/mask";

const Confidence = z.number().min(0).max(1);
export const PoseImageOptions = z.strictObject({
	segmentationEnabled: z.boolean().default(false),
	maskMaxDimension: MaskMaxDimension.default(256),
	maxPoses: MaxPoses.default(1),
	modelVariant: ModelVariant.default("full"),
	modelPath: z.string().optional(),
	maxImageDimension: z.number().int().min(256).max(2048).default(2048),
	minPoseDetectionConfidence: Confidence.default(0.35),
	minPosePresenceConfidence: Confidence.default(0.35),
});
export type PoseImageOptions = z.input<typeof PoseImageOptions>;
// Shared by PoseDetection and the strict detection recording schema, which drops `segmentation` first.
export const createPoseDetectionFields = (isStrict: boolean) => ({
	poses: createPoseResultsSchema(isStrict).optional(),
	landmarks: z.array(createLandmarkSchema(isStrict)),
	worldLandmarks: z.array(createLandmarkSchema(isStrict)),
	imageSize: createObjectSchema(
		{
			width: z.number().int().positive(),
			height: z.number().int().positive(),
		},
		isStrict,
	),
	inferenceDurationMs: z.number().nonnegative(),
	model: createObjectSchema(
		{
			variant: ModelVariant,
			source: z.enum(["bundled", "local"]),
			delegate: z.enum(["CPU", "GPU"]),
		},
		isStrict,
	),
});
export const PoseDetection = z.object({
	segmentation: PoseSegmentation.optional(),
	...createPoseDetectionFields(false),
});
export type PoseDetection = z.infer<typeof PoseDetection>;

export function validateLocalFileLocation(location: string): void {
	if (location.includes("\0"))
		throw new TypeError("File location contains a null character");
	if (location.startsWith("/")) return;
	const url = new URL(location);
	if (url.protocol !== "file:")
		throw new TypeError("Expected an absolute path or local file URI");
	if (url.hostname !== "" && url.hostname !== "localhost")
		throw new TypeError("Remote file authorities are unsupported");
	if (url.search !== "" || url.hash !== "")
		throw new TypeError(
			"File URIs must not contain query or fragment components",
		);
}
export function resolvePoseImageOptions(imageOptions: PoseImageOptions = {}) {
	const checkedOptions = PoseImageOptions.parse(imageOptions);
	const { modelPath } = checkedOptions;
	const isModelPathGiven = modelPath != null;
	if (isModelPathGiven) validateLocalFileLocation(modelPath);

	const isLocalModelMissing =
		checkedOptions.modelVariant !== "full" && modelPath == null;
	if (isLocalModelMissing)
		throw new TypeError(
			"A local modelPath is required for lite or heavy models",
		);
	return checkedOptions;
}
