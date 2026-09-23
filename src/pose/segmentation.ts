import { Schema } from "effect";

const Dimension = Schema.Number.pipe(Schema.int(), Schema.positive());
export const MaskMaxDimension = Schema.Number.pipe(
	Schema.int(),
	Schema.between(64, 512),
);
export const PoseSegmentationMask = Schema.Struct({
	poseIndex: Schema.Number.pipe(Schema.int(), Schema.between(0, 5)),
	uri: Schema.String.pipe(Schema.pattern(/^file:\//)),
	width: Dimension.pipe(Schema.lessThanOrEqualTo(512)),
	height: Dimension.pipe(Schema.lessThanOrEqualTo(512)),
});
export type PoseSegmentationMask = Schema.Schema.Type<
	typeof PoseSegmentationMask
>;
export const PoseSegmentation = Schema.Union(
	Schema.Struct({ status: Schema.Literal("empty", "backpressure") }),
	Schema.Struct({
		status: Schema.Literal("available"),
		leaseId: Schema.UUID,
		imageSize: Schema.Struct({ width: Dimension, height: Dimension }),
		masks: Schema.Array(PoseSegmentationMask).pipe(
			Schema.minItems(1),
			Schema.maxItems(6),
			Schema.filter((masks) =>
				masks.every((mask, index) => mask.poseIndex === index),
			),
		),
	}),
);
export type PoseSegmentation = Schema.Schema.Type<typeof PoseSegmentation>;
