import { z } from "zod";
import { PoseSegmentation } from "./segmentation/mask";

// zod numbers reject NaN and Infinity, so no separate finite check is needed.
const Finite = z.number();
const Confidence = Finite.min(0).max(1);
const Positive = Finite.positive();
const NonNegative = Finite.nonnegative();

// Live native results drop unknown keys (zod's default). Recording files reject them at every depth.
export const createObjectSchema = <Fields extends z.ZodRawShape>(
	fields: Fields,
	isStrict: boolean,
) => (isStrict ? z.strictObject(fields) : z.object(fields));

export const CameraFacing = z.enum(["front", "back"]);
export const CameraLens = z.enum(["auto", "wide", "ultraWide"]);
export const CameraLensWithoutAuto = z.enum(["wide", "ultraWide"]);
export type CameraFacing = z.infer<typeof CameraFacing>;
export type CameraLens = z.infer<typeof CameraLens>;
export const ModelVariant = z.enum(["lite", "full", "heavy"]);

export const createLandmarkSchema = (isStrict: boolean) =>
	createObjectSchema(
		{
			x: Finite,
			y: Finite,
			z: Finite,
			visibility: Confidence.optional(),
			presence: Confidence.optional(),
		},
		isStrict,
	);
export const Landmark = createLandmarkSchema(false);
export type Landmark = z.infer<typeof Landmark>;

export const MaxPoses = z.number().int().min(1).max(6);
const createPoseLandmarksSchema = (isStrict: boolean) =>
	createObjectSchema(
		{
			landmarks: z.array(createLandmarkSchema(isStrict)).max(33),
			worldLandmarks: z.array(createLandmarkSchema(isStrict)).max(33),
		},
		isStrict,
	);
export const PoseLandmarks = createPoseLandmarksSchema(false);
export type PoseLandmarks = z.infer<typeof PoseLandmarks>;
export const createPoseResultsSchema = (isStrict: boolean) =>
	z.array(createPoseLandmarksSchema(isStrict)).max(6);
export const PoseResults = createPoseResultsSchema(false);

export const CameraConfiguration = z.object({
	effectiveFacing: CameraFacing,
	effectiveLens: CameraLensWithoutAuto,
	appliedZoomFactor: Finite.min(1).max(100),
	mirrored: z.boolean(),
	captureWidth: Positive,
	captureHeight: Positive,
});
export type CameraConfiguration = z.infer<typeof CameraConfiguration>;

export const InferenceError = z.object({
	code: z.enum([
		"cameraConfiguration",
		"cameraPermission",
		"cameraRuntime",
		"inferenceRuntime",
		"modelInitialization",
		"nativeViewInitialization",
		"invalidNativeEvent",
		"segmentationCleanup",
	]),
});
export type InferenceError = z.infer<typeof InferenceError>;

export const PosePerformanceMetrics = z.object({
	intervalMs: Positive,
	observedFrames: NonNegative.int(),
	inferenceCount: NonNegative.int(),
	resultCount: NonNegative.int(),
	skippedInferenceFrames: NonNegative.int(),
	observedFps: NonNegative,
	inferenceFps: NonNegative,
	resultFps: NonNegative,
	averageInferenceDurationMs: NonNegative.nullable(),
});
export type PosePerformanceMetrics = z.infer<typeof PosePerformanceMetrics>;

// Shared by PoseFrame and the strict recording schema, which drops `segmentation` first.
export const createPoseFrameFields = (isStrict: boolean) => ({
	poses: createPoseResultsSchema(isStrict).optional(),
	landmarks: z.array(createLandmarkSchema(isStrict)),
	worldLandmarks: z.array(createLandmarkSchema(isStrict)),
	additionalData: createObjectSchema(
		{
			width: Positive,
			height: Positive,
			cameraFacing: CameraFacing,
			cameraLens: CameraLensWithoutAuto,
			cameraMirrored: z.boolean(),
			cameraZoomFactor: Finite.min(1).max(100),
			receivedAtMs: NonNegative,
			frameNumber: NonNegative.int(),
			inferenceDurationMs: NonNegative,
			luminance: Confidence,
			poseCount: NonNegative.int(),
			poseModelDelegate: z.enum(["CPU", "GPU"]),
			poseModelSource: z.enum(["bundled", "local"]),
			poseModelVariant: ModelVariant,
			thermalState: z.enum([
				"nominal",
				"fair",
				"serious",
				"critical",
				"unknown",
			]),
		},
		isStrict,
	),
});
export const PoseFrame = z.object({
	segmentation: PoseSegmentation.optional(),
	...createPoseFrameFields(false),
});
export type PoseFrame = z.infer<typeof PoseFrame>;
