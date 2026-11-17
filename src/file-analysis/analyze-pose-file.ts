import { z } from "zod";
import { getNativeModule } from "../native-module";
import { discardReportPersonMask } from "../person-mask/release-person-mask";
import {
	createVideoSamplePlan,
	PoseDetection,
	type PoseImageOptions,
	PoseVideoFrame,
	type PoseVideoOptions,
	resolvePoseImageOptions,
	resolvePoseVideoOptions,
	validateLocalFileLocation,
} from "./file-analysis-options";

type PoseFileKind = "image" | "video";

const FileKindLabel: Record<PoseFileKind, string> = {
	image: "Image",
	video: "Video",
};
const VideoHandle = z.object({
	id: z.string().min(1),
});
const VideoSession = VideoHandle.extend({
	durationMs: z.number().positive(),
});
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
const readMaskHolder = (kind: PoseFileKind, reply: unknown): unknown => {
	const isVideo = kind === "video";
	return isVideo ? readVideoDetection(reply) : reply;
};
const parseReplyOrReleaseMask = async <Schema extends z.ZodType>(
	kind: PoseFileKind,
	schema: Schema,
	reply: unknown,
): Promise<z.infer<Schema>> => {
	const result = schema.safeParse(reply);
	if (result.success) return result.data;

	try {
		await discardReportPersonMask(readMaskHolder(kind, reply));
	} catch (cleanupError) {
		throw new AggregateError(
			[result.error, cleanupError],
			`${FileKindLabel[kind]} result validation and mask cleanup failed`,
			{ cause: result.error },
		);
	}
	throw result.error;
};
export const analyzePoseImage = async (
	location: string,
	imageSettings: PoseImageOptions = {},
): Promise<PoseDetection> => {
	validateLocalFileLocation(location);
	const checkedSettings = resolvePoseImageOptions(imageSettings);
	const native = getNativeModule();
	const analysis = await native.analyzePoseImage(location, checkedSettings);
	return parseReplyOrReleaseMask("image", PoseDetection, analysis);
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
	const native = getNativeModule();
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
			const frame = await parseReplyOrReleaseMask(
				"video",
				PoseVideoFrame,
				unparsedFrame,
			);
			undelivered = frame.detection;
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
			await discardReportPersonMask(undelivered);
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
