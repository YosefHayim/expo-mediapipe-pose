import { z } from "zod";

const Dimension = z.number().int().positive();
export const MaskMaxDimension = z.number().int().min(64).max(512);
// UUID shape: 8-4-4-4-12 hex digits, either case.
export const PersonMaskLeaseId = z
	.string()
	.regex(
		/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
	);
export const PosePersonMaskImage = z.object({
	poseIndex: z.number().int().min(0).max(5),
	uri: z.string().regex(/^file:\//),
	width: Dimension.max(512),
	height: Dimension.max(512),
});
export type PosePersonMaskImage = z.infer<typeof PosePersonMaskImage>;
export const PosePersonMask = z.union([
	z.object({ status: z.enum(["empty", "backpressure"]) }),
	z.object({
		status: z.literal("available"),
		leaseId: PersonMaskLeaseId,
		imageSize: z.object({ width: Dimension, height: Dimension }),
		masks: z
			.array(PosePersonMaskImage)
			.min(1)
			.max(6)
			.refine((masks) =>
				masks.every((mask, index) => mask.poseIndex === index),
			),
	}),
]);
export type PosePersonMask = z.infer<typeof PosePersonMask>;
