import { requireNativeModule } from "expo";
import { z } from "zod";
import { validateLocalFileLocation } from "../image/analysis";
import { discardReportSegmentation } from "../segmentation/native";
import {
	createVideoSamplePlan,
	PoseVideoFrame,
	type PoseVideoOptions,
	resolvePoseVideoOptions,
} from "./analysis";

const VideoHandle = z.object({
	id: z.string().min(1),
});
const VideoSession = VideoHandle.extend({
	durationMs: z.number().positive(),
});
interface NativeVideoAnalysis {
	openPoseVideo(
		location: string,
		settings: ReturnType<typeof resolvePoseVideoOptions>["image"],
		trackingConfidence: number,
	): Promise<unknown>;
	readPoseVideoFrame(id: string, timestampMs: number): Promise<unknown>;
	closePoseVideo(id: string): Promise<void>;
}
const createAbortError = () => {
	const error = new Error("Video analysis was cancelled");
	error.name = "AbortError";
	return error;
};
const throwIfAborted = (signal: AbortSignal | undefined) => {
	const isSignalAborted = signal?.aborted === true;
	if (isSignalAborted) throw createAbortError();
};
const throwVideoFailures = (failures: unknown[]) => {
	const isFailuresEmpty = failures.length === 0;
	if (isFailuresEmpty) return;

	const primary = failures[0];

	const hasOneFailure = failures.length === 1;
	if (hasOneFailure) throw primary;

	const isPrimaryError = primary instanceof Error;
	const message = isPrimaryError ? primary.message : String(primary);
	const combined = new AggregateError(
		failures,
		`${message} (video cleanup also failed)`,
		{ cause: primary },
	);

	if (isPrimaryError) combined.name = primary.name;

	throw combined;
};
const readVideoDetection = (frame: unknown): unknown => {
	const isFrameNotObject = typeof frame !== "object" || frame === null;
	if (isFrameNotObject) return null;

	const isFrameWithoutDetection = !("detection" in frame);
	if (isFrameWithoutDetection) return null;

	return frame.detection;
};
// An arrow cannot be a generator, so this stays a const function expression.
export const analyzePoseVideo = async function* (
	location: string,
	videoSettings: PoseVideoOptions = {},
): AsyncGenerator<PoseVideoFrame, void, void> {
	validateLocalFileLocation(location);
	const { image, sampling, signal, onProgress } =
		resolvePoseVideoOptions(videoSettings);
	throwIfAborted(signal);
	const native = requireNativeModule<NativeVideoAnalysis>("ExpoMediaPipePose");
	const unparsedSession = await native.openPoseVideo(
		location,
		image,
		sampling.minTrackingConfidence,
	);
	const handle = VideoHandle.parse(unparsedSession);
	let closing: Promise<void> | null = null;
	const close = () => {
		closing ??= native.closePoseVideo(handle.id);
		return closing;
	};
	// A consumer may pause indefinitely at yield; cancellation must still release native resources.
	const closeOnAbort = () => {
		void close().catch(() => {});
	};
	signal?.addEventListener("abort", closeOnAbort, { once: true });
	const failures: unknown[] = [];
	let undelivered: unknown = null;
	try {
		const session = VideoSession.parse(unparsedSession);
		throwIfAborted(signal);
		const plan = createVideoSamplePlan(session.durationMs, sampling);
		for (let index = 0; index < plan.frameCount; index += 1) {
			throwIfAborted(signal);
			const timestampMs = plan.timestampMsAt(index);
			const unparsedFrame = await native.readPoseVideoFrame(
				session.id,
				timestampMs,
			);
			undelivered = readVideoDetection(unparsedFrame);
			const frame = PoseVideoFrame.parse(unparsedFrame);
			throwIfAborted(signal);

			const isTimestampMismatched = frame.timestampMs !== timestampMs;
			if (isTimestampMismatched)
				throw new Error(
					"Native video timestamp does not match the requested sample",
				);

			onProgress?.({
				completedFrames: index + 1,
				totalFrames: plan.frameCount,
				timestampMs,
			});
			throwIfAborted(signal);
			undelivered = null;
			yield frame;
		}
	} catch (error) {
		const isSignalAborted = signal?.aborted === true;
		failures.push(isSignalAborted ? createAbortError() : error);
	} finally {
		signal?.removeEventListener("abort", closeOnAbort);
		try {
			await discardReportSegmentation(undelivered);
		} catch (error) {
			failures.push(error);
		}
		try {
			await close();
		} catch (error) {
			failures.push(error);
		}
		throwVideoFailures(failures);
	}
};
