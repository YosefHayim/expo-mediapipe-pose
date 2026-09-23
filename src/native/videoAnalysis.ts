import { Schema } from "effect";
import { requireNativeModule } from "expo";
import { validateLocalFileLocation } from "../pose/imageAnalysis";
import {
	createVideoSamplePlan,
	PoseVideoFrame,
	type PoseVideoOptions,
	resolvePoseVideoOptions,
} from "../pose/videoAnalysis";

import { discardResultSegmentation } from "./segmentation";

const VideoHandle = Schema.Struct({
	id: Schema.String.pipe(Schema.nonEmptyString()),
});
const VideoSession = Schema.Struct({
	...VideoHandle.fields,
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
function createAbortError() {
	const error = new Error("Video analysis was cancelled");
	error.name = "AbortError";
	return error;
}
function throwIfAborted(signal: AbortSignal | undefined) {
	if (signal?.aborted) throw createAbortError();
}
function throwVideoFailures(failures: unknown[]) {
	if (failures.length === 0) return;
	const primary = failures[0];
	if (failures.length === 1) throw primary;
	const message = primary instanceof Error ? primary.message : String(primary);
	const combined = new AggregateError(
		failures,
		`${message} (video cleanup also failed)`,
		{ cause: primary },
	);
	if (primary instanceof Error) combined.name = primary.name;
	throw combined;
}
function videoDetection(frame: unknown): unknown {
	if (typeof frame !== "object" || frame === null) return undefined;
	if (!("detection" in frame)) return undefined;
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
	const handle = Schema.decodeUnknownSync(VideoHandle)(rawSession);
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
		const session = Schema.decodeUnknownSync(VideoSession)(rawSession);
		throwIfAborted(signal);
		const plan = createVideoSamplePlan(session.durationMs, sampling);
		for (let index = 0; index < plan.frameCount; index += 1) {
			throwIfAborted(signal);
			const timestampMs = plan.timestampAt(index);
			const rawFrame = await native.readPoseVideoFrame(session.id, timestampMs);
			undelivered = videoDetection(rawFrame);
			const frame = Schema.decodeUnknownSync(PoseVideoFrame)(rawFrame);
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
			undelivered = undefined;
			yield frame;
		}
	} catch (error) {
		failures.push(signal?.aborted ? createAbortError() : error);
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
