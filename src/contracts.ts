import { Schema } from "effect";
import { PoseSegmentation } from "./pose/segmentation";

const Finite = Schema.Number.pipe(Schema.finite());
const Confidence = Finite.pipe(Schema.between(0, 1));
const Positive = Finite.pipe(Schema.positive());
const NonNegative = Finite.pipe(Schema.nonNegative());

export const CameraFacing = Schema.Literal("front", "back");
export const CameraLens = Schema.Literal("auto", "wide", "ultraWide");
export type CameraFacing = Schema.Schema.Type<typeof CameraFacing>;
export type CameraLens = Schema.Schema.Type<typeof CameraLens>;
export const ModelVariant = Schema.Literal("lite", "full", "heavy");

export const Landmark = Schema.mutable(
	Schema.Struct({
		x: Finite,
		y: Finite,
		z: Finite,
		visibility: Schema.optional(Confidence),
		presence: Schema.optional(Confidence),
	}),
);

export const MaxPoses = Schema.Number.pipe(Schema.int(), Schema.between(1, 6));
export const PoseLandmarks = Schema.Struct({
	landmarks: Schema.mutable(Schema.Array(Landmark).pipe(Schema.maxItems(33))),
	worldLandmarks: Schema.mutable(
		Schema.Array(Landmark).pipe(Schema.maxItems(33)),
	),
});
export type PoseLandmarks = Schema.Schema.Type<typeof PoseLandmarks>;
export const PoseResults = Schema.Array(PoseLandmarks).pipe(Schema.maxItems(6));

export const CameraConfiguration = Schema.Struct({
	effectiveFacing: CameraFacing,
	effectiveLens: Schema.Literal("wide", "ultraWide"),
	appliedZoomFactor: Finite.pipe(Schema.between(1, 100)),
	mirrored: Schema.Boolean,
	captureWidth: Positive,
	captureHeight: Positive,
});

export const InferenceError = Schema.Struct({
	code: Schema.Literal(
		"cameraConfiguration",
		"cameraPermission",
		"cameraRuntime",
		"inferenceRuntime",
		"modelInitialization",
		"nativeViewInitialization",
		"invalidNativeEvent",
		"segmentationCleanup",
	),
});

export const PosePerformanceMetrics = Schema.Struct({
	intervalMs: Positive,
	observedFrames: NonNegative.pipe(Schema.int()),
	inferenceCount: NonNegative.pipe(Schema.int()),
	resultCount: NonNegative.pipe(Schema.int()),
	skippedInferenceFrames: NonNegative.pipe(Schema.int()),
	observedFps: NonNegative,
	inferenceFps: NonNegative,
	resultFps: NonNegative,
	averageInferenceDurationMs: Schema.NullOr(NonNegative),
});
export type PosePerformanceMetrics = Schema.Schema.Type<
	typeof PosePerformanceMetrics
>;

export const PoseFrame = Schema.Struct({
	segmentation: Schema.optional(PoseSegmentation),
	poses: Schema.optional(PoseResults),
	landmarks: Schema.mutable(Schema.Array(Landmark)),
	worldLandmarks: Schema.mutable(Schema.Array(Landmark)),
	additionalData: Schema.Struct({
		width: Positive,
		height: Positive,
		cameraFacing: CameraFacing,
		cameraLens: Schema.Literal("wide", "ultraWide"),
		cameraMirrored: Schema.Boolean,
		cameraZoomFactor: Finite.pipe(Schema.between(1, 100)),
		receivedAtMs: NonNegative,
		frameNumber: NonNegative.pipe(Schema.int()),
		inferenceDurationMs: NonNegative,
		luminance: Confidence,
		poseCount: NonNegative.pipe(Schema.int()),
		poseModelDelegate: Schema.Literal("CPU", "GPU"),
		poseModelSource: Schema.Literal("bundled", "local"),
		poseModelVariant: ModelVariant,
		thermalState: Schema.Literal(
			"nominal",
			"fair",
			"serious",
			"critical",
			"unknown",
		),
	}),
});

export type PoseFrame = Schema.Schema.Type<typeof PoseFrame>;
export type Landmark = Schema.Schema.Type<typeof Landmark>;
export type CameraConfiguration = Schema.Schema.Type<
	typeof CameraConfiguration
>;
export type InferenceError = Schema.Schema.Type<typeof InferenceError>;
