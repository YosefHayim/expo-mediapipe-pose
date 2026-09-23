import { Schema } from "effect";
import { requireNativeModule } from "expo";
import { validateLocalFileLocation } from "../pose/imageAnalysis";
import {
	createVideoSamplePlan,
	PoseVideoFrame,
	type PoseVideoOptions,
	resolvePoseVideoOptions,
} from "../pose/videoAnalysis";

const VideoSession = Schema.Struct({
	id: Schema.String.pipe(Schema.nonEmptyString()),
	durationMs: Schema.Number.pipe(Schema.finite(), Schema.positive()),
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
function throwIfAborted(signal: AbortSignal | undefined) {
	if (!signal?.aborted) return;
	const error = new Error("Video analysis was cancelled");
	error.name = "AbortError";
	throw error;
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
	const session = Schema.decodeUnknownSync(VideoSession)(
		await native.openPoseVideo(location, image, sampling.minTrackingConfidence),
	);
	let closing: Promise<void> | undefined;
	const close = () => {
		closing ??= native.closePoseVideo(session.id);
		return closing;
	};
	// A consumer may pause indefinitely at yield; cancellation must still release native resources.
	const onAbort = () => {
		void close().catch(() => {});
	};
	signal?.addEventListener("abort", onAbort, { once: true });
	try {
		throwIfAborted(signal);
		const plan = createVideoSamplePlan(session.durationMs, sampling);
		for (let index = 0; index < plan.frameCount; index += 1) {
			throwIfAborted(signal);
			const timestampMs = plan.timestampAt(index);
			const frame = Schema.decodeUnknownSync(PoseVideoFrame)(
				await native.readPoseVideoFrame(session.id, timestampMs),
			);
			throwIfAborted(signal);
			if (frame.timestampMs !== timestampMs)
				throw new Error(
					"Native video timestamp does not match the requested sample",
				);
			onProgress?.({
				completedFrames: index + 1,
				totalFrames: plan.frameCount,
				timestampMs,
			});
			throwIfAborted(signal);
			yield frame;
		}
	} catch (error) {
		throwIfAborted(signal);
		throw error;
	} finally {
		signal?.removeEventListener("abort", onAbort);
		await close();
	}
}
