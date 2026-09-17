import { Schema } from "effect";

const Finite = Schema.Number.pipe(Schema.finite());
const Confidence = Finite.pipe(Schema.between(0, 1));
const Positive = Finite.pipe(Schema.positive());
const NonNegative = Finite.pipe(Schema.nonNegative());

export const CameraFacing = Schema.Literal("front", "back");
export const CameraLens = Schema.Literal("auto", "wide", "ultraWide");
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
	),
});

export const PoseFrame = Schema.Struct({
	landmarks: Schema.mutable(Schema.Array(Landmark)),
	worldLandmarks: Schema.mutable(Schema.Array(Landmark)),
	additionalData: Schema.Struct({
		width: Positive,
		height: Positive,
		cameraFacing: CameraFacing,
		cameraLens: Schema.Literal("wide", "ultraWide"),
		cameraMirrored: Schema.Boolean,
		cameraZoomFactor: Finite.pipe(Schema.between(1, 100)),
		capturedAtMs: NonNegative,
		frameNumber: NonNegative.pipe(Schema.int()),
		inferenceDurationMs: NonNegative,
		luminance: Confidence,
		poseCount: NonNegative.pipe(Schema.int()),
		poseModelDelegate: Schema.Literal("CPU", "GPU"),
		poseModelSource: Schema.Literal("bundled", "downloaded"),
		poseModelVariant: ModelVariant,
		thermalState: Schema.Literal("nominal", "fair", "serious", "critical"),
	}),
});

export type PoseFrame = Schema.Schema.Type<typeof PoseFrame>;
export type CameraConfiguration = Schema.Schema.Type<
	typeof CameraConfiguration
>;
export type InferenceError = Schema.Schema.Type<typeof InferenceError>;
