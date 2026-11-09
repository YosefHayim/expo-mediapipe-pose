import { requireNativeModule } from "expo";
import { z } from "zod";
import { validateLocalFileLocation } from "../image/analysis";
import { discardResultSegmentation } from "../segmentation/native";
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
		options: ReturnType<typeof resolvePoseVideoOptions>["image"],
		trackingConfidence: number,
	): Promise<unknown>;
	readPoseVideoFrame(id: string, timestampMs: number): Promise<unknown>;
	closePoseVideo(id: string): Promise<void>;
}
function createAbortError() {
	const error = new Error("Video analysis was cancelled");
	error.name = "AbortError";
	return error;
}
function throwIfAborted(signal: AbortSignal | undefined) {
	const isSignalAborted = signal?.aborted === true;
	if (isSignalAborted) throw createAbortError();
}
function throwVideoFailures(failures: unknown[]) {
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
}
function videoDetection(frame: unknown): unknown {
	const isFrameNotObject = typeof frame !== "object" || frame === null;
	if (isFrameNotObject) return undefined;

	const isFrameWithoutDetection = !("detection" in frame);
	if (isFrameWithoutDetection) return undefined;

	return frame.detection;
}
export async function* analyzePoseVideo(
	location: string,
	options: PoseVideoOptions = {},
): AsyncGenerator<PoseVideoFrame, void, void> {
	validateLocalFileLocation(location);
	const { image, sampling, signal, onProgress } =
		resolvePoseVideoOptions(options);
	throwIfAborted(signal);
	const native = requireNativeModule<NativeVideoAnalysis>("ExpoMediaPipePose");
	const rawSession = await native.openPoseVideo(
		location,
		image,
		sampling.minTrackingConfidence,
	);
	const handle = VideoHandle.parse(rawSession);
	let closing: Promise<void> | undefined;
	const close = () => {
		closing ??= native.closePoseVideo(handle.id);
		return closing;
	};
	// A consumer may pause indefinitely at yield; cancellation must still release native resources.
	const onAbort = () => {
		void close().catch(() => {});
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	const failures: unknown[] = [];
	let undelivered: unknown;
	try {
		const session = VideoSession.parse(rawSession);
		throwIfAborted(signal);
		const plan = createVideoSamplePlan(session.durationMs, sampling);
		for (let index = 0; index < plan.frameCount; index += 1) {
			throwIfAborted(signal);
			const timestampMs = plan.timestampAt(index);
			const rawFrame = await native.readPoseVideoFrame(session.id, timestampMs);
			undelivered = videoDetection(rawFrame);
			const frame = PoseVideoFrame.parse(rawFrame);
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
			undelivered = undefined;
			yield frame;
		}
	} catch (error) {
		const isSignalAborted = signal?.aborted === true;
		failures.push(isSignalAborted ? createAbortError() : error);
	} finally {
		signal?.removeEventListener("abort", onAbort);
		try {
			await discardResultSegmentation(undelivered);
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
}
