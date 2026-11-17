import { z } from "zod";
import { MaskMaxDimension, PosePersonMask } from "../person-mask/person-mask";
import {
	createLandmarkSchema,
	createObjectSchema,
	createPoseResultsSchema,
	MaxPoses,
	ModelVariant,
} from "../shared-contracts";

const Confidence = z.number().min(0).max(1);
export const PoseImageOptions = z.strictObject({
	personMaskEnabled: z.boolean().default(false),
	maskMaxDimension: MaskMaxDimension.default(256),
	maxPoses: MaxPoses.default(1),
	modelVariant: ModelVariant.default("full"),
	modelPath: z.string().optional(),
	maxImageDimension: z.number().int().min(256).max(2048).default(2048),
	minPoseDetectionConfidence: Confidence.default(0.35),
	minPosePresenceConfidence: Confidence.default(0.35),
});
export type PoseImageOptions = z.input<typeof PoseImageOptions>;
// Shared by PoseDetection and the strict detection recording schema, which drops `personMask` first.
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
	personMask: PosePersonMask.optional(),
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

const Milliseconds = z.number().int().min(0).max(86_400_000);
export const PoseVideoSampling = z.strictObject({
	samplingFps: z.number().int().min(1).max(60).default(5),
	startMs: Milliseconds.default(0),
	endMs: Milliseconds.optional(),
	maxFrames: z.number().int().min(1).max(10_000).default(1000),
	minTrackingConfidence: z.number().min(0).max(1).default(0.35),
});
export const PoseVideoFrame = z.object({
	timestampMs: Milliseconds,
	decodedTimestampMs: z.number().nonnegative().nullable(),
	detection: PoseDetection,
});
export type PoseVideoFrame = z.infer<typeof PoseVideoFrame>;
export interface PoseVideoProgress {
	completedFrames: number;
	totalFrames: number;
	timestampMs: number;
}
export type PoseVideoOptions = PoseImageOptions &
	z.input<typeof PoseVideoSampling> & {
		signal?: AbortSignal;
		onProgress?: (progress: PoseVideoProgress) => void;
	};
export const resolvePoseVideoOptions = (settings: PoseVideoOptions = {}) => {
	const {
		samplingFps,
		startMs,
		endMs,
		maxFrames,
		minTrackingConfidence,
		signal,
		onProgress,
		...image
	} = settings;
	const sampling = PoseVideoSampling.parse({
		samplingFps,
		startMs,
		endMs,
		maxFrames,
		minTrackingConfidence,
	});
	return {
		image: resolvePoseImageOptions(image),
		sampling,
		signal,
		onProgress,
	};
};
export const createVideoSamplePlan = (
	durationMs: number,
	samplingSettings: z.input<typeof PoseVideoSampling> = {},
) => {
	const isDurationInvalid = !Number.isFinite(durationMs) || durationMs <= 0;
	if (isDurationInvalid)
		throw new RangeError("Video duration must be finite and positive");

	const sampling = PoseVideoSampling.parse(samplingSettings);

	const endMs = sampling.endMs ?? durationMs;

	const isEndOutOfRange = endMs > durationMs || endMs > 86_400_000;
	if (isEndOutOfRange)
		throw new RangeError(
			"Video range exceeds its duration or the 24-hour limit",
		);

	const isSamplingStartAfterEnd = sampling.startMs >= endMs;
	if (isSamplingStartAfterEnd)
		throw new RangeError("Video start must precede its end");

	const frameCount = Math.ceil(
		((endMs - sampling.startMs) * sampling.samplingFps) / 1000,
	);

	const isFrameCountOverLimit = frameCount > sampling.maxFrames;
	if (isFrameCountOverLimit)
		throw new RangeError(
			"Sampling exceeds maxFrames; shorten the range or reduce samplingFps",
		);

	return {
		frameCount,
		timestampMsAt(index: number) {
			const isFrameIndexOutOfRange =
				!Number.isInteger(index) || index < 0 || index >= frameCount;
			if (isFrameIndexOutOfRange)
				throw new RangeError("Sample index is outside the video range");

			return (
				sampling.startMs + Math.floor((index * 1000) / sampling.samplingFps)
			);
		},
	};
};
