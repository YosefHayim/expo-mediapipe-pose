import { z } from "zod";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
} from "../image/analysis";

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
