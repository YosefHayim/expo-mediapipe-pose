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

export const validateLocalFileLocation = (location: string): void => {
	const hasNullByte = location.includes("\0");
	if (hasNullByte)
		throw new TypeError("File location contains a null character");

	const isAbsoluteLocation = location.startsWith("/");
	if (isAbsoluteLocation) return;

	const url = new URL(location);

	const isNonFileUrl = url.protocol !== "file:";
	if (isNonFileUrl)
		throw new TypeError("Expected an absolute path or local file URI");

	const isRemoteHost = url.hostname !== "" && url.hostname !== "localhost";
	if (isRemoteHost)
		throw new TypeError("Remote file authorities are unsupported");

	const hasQueryOrHash = url.search !== "" || url.hash !== "";
	if (hasQueryOrHash)
		throw new TypeError(
			"File URIs must not contain query or fragment components",
		);
};
export const resolvePoseImageOptions = (
	imageSettings: PoseImageOptions = {},
) => {
	const checkedSettings = PoseImageOptions.parse(imageSettings);
	const { modelPath } = checkedSettings;

	const isModelPathGiven = modelPath != null;
	if (isModelPathGiven) validateLocalFileLocation(modelPath);

	const isLocalModelMissing =
		checkedSettings.modelVariant !== "full" && modelPath == null;
	if (isLocalModelMissing)
		throw new TypeError(
			"A local modelPath is required for lite or heavy models",
		);

	return checkedSettings;
};
