import { z } from "zod";

const LANDMARK_COUNT = 33;
const VALUES_PER_LANDMARK = 3;

const recordedFrameSchema = z
	.array(z.number())
	.refine(
		(frame) =>
			frame.length === 0 ||
			frame.length === LANDMARK_COUNT * VALUES_PER_LANDMARK,
		"A frame holds no numbers or 99 numbers.",
	);

export const heroLandmarksSchema = z.object({
	version: z.literal(1),
	fps: z.number().positive(),
	width: z.number().positive(),
	height: z.number().positive(),
	durationMs: z.number().positive(),
	frames: z.array(recordedFrameSchema).min(1),
});

export type HeroLandmarks = z.infer<typeof heroLandmarksSchema>;
