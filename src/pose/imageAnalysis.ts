import { Schema } from "effect";
import { Landmark, MaxPoses, ModelVariant, PoseResults } from "../contracts";

import { MaskMaxDimension, PoseSegmentation } from "./segmentation";

const Confidence = Schema.Number.pipe(Schema.finite(), Schema.between(0, 1));
export const PoseImageOptions = Schema.Struct({
	segmentationEnabled: Schema.optionalWith(Schema.Boolean, {
		default: () => false,
	}),
	maskMaxDimension: Schema.optionalWith(MaskMaxDimension, {
		default: () => 256,
	}),
	maxPoses: Schema.optionalWith(MaxPoses, { default: () => 1 }),
	modelVariant: Schema.optionalWith(ModelVariant, {
		default: () => "full" as const,
	}),
	modelPath: Schema.optional(Schema.String),
	maxImageDimension: Schema.optionalWith(
		Schema.Number.pipe(Schema.int(), Schema.between(256, 2048)),
		{ default: () => 2048 },
	),
	minPoseDetectionConfidence: Schema.optionalWith(Confidence, {
		default: () => 0.35,
	}),
	minPosePresenceConfidence: Schema.optionalWith(Confidence, {
		default: () => 0.35,
	}),
});
export type PoseImageOptions = Schema.Schema.Encoded<typeof PoseImageOptions>;
export const PoseDetection = Schema.Struct({
	segmentation: Schema.optional(PoseSegmentation),
	poses: Schema.optional(PoseResults),
	landmarks: Schema.mutable(Schema.Array(Landmark)),
	worldLandmarks: Schema.mutable(Schema.Array(Landmark)),
	imageSize: Schema.Struct({
		width: Schema.Number.pipe(Schema.int(), Schema.positive()),
		height: Schema.Number.pipe(Schema.int(), Schema.positive()),
	}),
	inferenceDurationMs: Schema.Number.pipe(
		Schema.finite(),
		Schema.nonNegative(),
	),
	model: Schema.Struct({
		variant: ModelVariant,
		source: Schema.Literal("bundled", "local"),
		delegate: Schema.Literal("CPU", "GPU"),
	}),
});
export type PoseDetection = Schema.Schema.Type<typeof PoseDetection>;

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
export function resolvePoseImageOptions(options: PoseImageOptions = {}) {
	const resolved = Schema.decodeUnknownSync(PoseImageOptions, {
		onExcessProperty: "error",
	})(options);
	if (resolved.modelPath !== undefined)
		validateLocalFileLocation(resolved.modelPath);
	if (resolved.modelVariant !== "full" && resolved.modelPath === undefined)
		throw new TypeError(
			"A local modelPath is required for lite or heavy models",
		);
	return resolved;
}
