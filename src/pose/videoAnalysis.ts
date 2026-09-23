import { Schema } from "effect";
import {
	PoseDetection,
	type PoseImageOptions,
	resolvePoseImageOptions,
} from "./imageAnalysis";

const Milliseconds = Schema.Number.pipe(
	Schema.int(),
	Schema.between(0, 86_400_000),
);
export const PoseVideoSampling = Schema.Struct({
	samplingFps: Schema.optionalWith(
		Schema.Number.pipe(Schema.int(), Schema.between(1, 60)),
		{ default: () => 5 },
	),
	startMs: Schema.optionalWith(Milliseconds, { default: () => 0 }),
	endMs: Schema.optional(Milliseconds),
	maxFrames: Schema.optionalWith(
		Schema.Number.pipe(Schema.int(), Schema.between(1, 10_000)),
		{ default: () => 1000 },
	),
	minTrackingConfidence: Schema.optionalWith(
		Schema.Number.pipe(Schema.finite(), Schema.between(0, 1)),
		{ default: () => 0.35 },
	),
});
export const PoseVideoFrame = Schema.Struct({
	timestampMs: Milliseconds,
	decodedTimestampMs: Schema.NullOr(
		Schema.Number.pipe(Schema.finite(), Schema.nonNegative()),
	),
	detection: PoseDetection,
});
export type PoseVideoFrame = Schema.Schema.Type<typeof PoseVideoFrame>;
export interface PoseVideoProgress {
	completedFrames: number;
	totalFrames: number;
	timestampMs: number;
}
export type PoseVideoOptions = PoseImageOptions &
	Schema.Schema.Encoded<typeof PoseVideoSampling> & {
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
	const sampling = Schema.decodeUnknownSync(PoseVideoSampling)({
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
	options: Schema.Schema.Encoded<typeof PoseVideoSampling> = {},
) {
	if (!Number.isFinite(durationMs) || durationMs <= 0)
		throw new RangeError("Video duration must be finite and positive");
	const sampling = Schema.decodeUnknownSync(PoseVideoSampling, {
		onExcessProperty: "error",
	})(options);
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
