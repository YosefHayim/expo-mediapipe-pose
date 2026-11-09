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
export function resolvePoseVideoOptions(options: PoseVideoOptions = {}) {
	const {
		samplingFps,
		startMs,
		endMs,
		maxFrames,
		minTrackingConfidence,
		signal,
		onProgress,
		...image
	} = options;
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
}
export function createVideoSamplePlan(
	durationMs: number,
	options: z.input<typeof PoseVideoSampling> = {},
) {
	if (!Number.isFinite(durationMs) || durationMs <= 0)
		throw new RangeError("Video duration must be finite and positive");
	const sampling = PoseVideoSampling.parse(options);
	const endMs = sampling.endMs ?? durationMs;
	if (endMs > durationMs || endMs > 86_400_000)
		throw new RangeError(
			"Video range exceeds its duration or the 24-hour limit",
		);
	if (sampling.startMs >= endMs)
		throw new RangeError("Video start must precede its end");
	const frameCount = Math.ceil(
		((endMs - sampling.startMs) * sampling.samplingFps) / 1000,
	);
	if (frameCount > sampling.maxFrames)
		throw new RangeError(
			"Sampling exceeds maxFrames; shorten the range or reduce samplingFps",
		);
	return {
		frameCount,
		timestampAt(index: number) {
			if (!Number.isInteger(index) || index < 0 || index >= frameCount)
				throw new RangeError("Sample index is outside the video range");
			return (
				sampling.startMs + Math.floor((index * 1000) / sampling.samplingFps)
			);
		},
	};
}
