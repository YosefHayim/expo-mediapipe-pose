import { z } from "zod";
import { createPoseFrameFields, type PoseFrame } from "../contracts";
import {
	createPoseDetectionFields,
	type PoseDetection,
} from "../image/analysis";

const RECORDING_VERSION = 1 as const;
const MAXIMUM_FRAMES = 10_000;
const MAXIMUM_LANDMARKS = 33;
const MAXIMUM_RECORDING_MILLISECONDS = 86_400_000;
const MAXIMUM_SERIALIZED_CHARACTERS = 64 * 1024 * 1024;

const hasWithinLandmarkLimit = (frame: {
	landmarks: unknown[];
	worldLandmarks: unknown[];
}) => {
	const hasWithinLandmarks = frame.landmarks.length <= MAXIMUM_LANDMARKS;
	const hasWithinWorldLandmarks =
		frame.worldLandmarks.length <= MAXIMUM_LANDMARKS;
	return hasWithinLandmarks && hasWithinWorldLandmarks;
};

const hasIncreasingTimestamps = (recording: {
	frames: Array<{ timestampMs: number }>;
}) => {
	const hasNoFrames = recording.frames.length === 0;
	if (hasNoFrames) return true;

	const isFirstFrameAtZero = recording.frames[0]?.timestampMs === 0;
	if (!isFirstFrameAtZero) return false;

	return recording.frames.every((recordedFrame, index) => {
		const isFirstFrame = index === 0;
		const previousFrame = recording.frames[index - 1];
		const isAfterPrevious =
			previousFrame !== undefined &&
			recordedFrame.timestampMs > previousFrame.timestampMs;
		return isFirstFrame || isAfterPrevious;
	});
};

const createRecordingSchema = <FrameSchema extends z.ZodType>(
	frameSchema: FrameSchema,
) => {
	const frameEntrySchema = z.strictObject({
		timestampMs: z.number().min(0).max(MAXIMUM_RECORDING_MILLISECONDS),
		frame: frameSchema,
	});
	const recordingShapeSchema = z.strictObject({
		version: z.literal(RECORDING_VERSION),
		frames: z.array(frameEntrySchema).max(MAXIMUM_FRAMES),
	});
	return recordingShapeSchema.refine(hasIncreasingTimestamps);
};

const withoutSegmentation = (candidateFrame: unknown): unknown => {
	const isObjectFrame =
		typeof candidateFrame === "object" && candidateFrame !== null;
	const hasSegmentation = isObjectFrame && "segmentation" in candidateFrame;
	if (!hasSegmentation) return candidateFrame;

	const { segmentation: _segmentation, ...landmarks } = candidateFrame;
	return landmarks;
};

const RecordedFrame = z
	.strictObject(createPoseFrameFields(true))
	.refine(hasWithinLandmarkLimit);
export const PoseRecording = createRecordingSchema(RecordedFrame);
export type PoseRecording = z.infer<typeof PoseRecording>;

const RecordedDetection = z
	.strictObject(createPoseDetectionFields(true))
	.refine(hasWithinLandmarkLimit);
export const PoseDetectionRecording = createRecordingSchema(RecordedDetection);
export type PoseDetectionRecording = z.infer<typeof PoseDetectionRecording>;

const decodeFrame = (candidateFrame: unknown) => {
	const frameWithoutSegmentation = withoutSegmentation(candidateFrame);
	return RecordedFrame.parse(frameWithoutSegmentation);
};

const decodeDetection = (candidateDetection: unknown) => {
	const detectionWithoutSegmentation = withoutSegmentation(candidateDetection);
	return RecordedDetection.parse(detectionWithoutSegmentation);
};

const assertWithinSerializedLimit = (serializedRecording: string) => {
	const isWithinLimit =
		serializedRecording.length <= MAXIMUM_SERIALIZED_CHARACTERS;
	if (isWithinLimit) return;

	throw new RangeError("Recording JSON exceeds 64 Mi characters");
};

const parseSerializedRecording = <Recording>(
	recordingSchema: z.ZodType<Recording>,
	serializedRecording: string,
): Recording => {
	assertWithinSerializedLimit(serializedRecording);

	const parsedRecording: unknown = JSON.parse(serializedRecording);
	return recordingSchema.parse(parsedRecording);
};

const serializeCheckedRecording = <Recording>(
	recordingSchema: z.ZodType<Recording>,
	recording: Recording,
): string => {
	const checkedRecording = recordingSchema.parse(recording);

	const serializedRecording = JSON.stringify(checkedRecording);
	assertWithinSerializedLimit(serializedRecording);
	return serializedRecording;
};

export const parsePoseRecording = (serializedRecording: string) =>
	parseSerializedRecording(PoseRecording, serializedRecording);

export const serializePoseRecording = (recording: PoseRecording) =>
	serializeCheckedRecording(PoseRecording, recording);

export const copyPoseRecording = (recording: PoseRecording) => {
	const serializedRecording = serializePoseRecording(recording);
	return parsePoseRecording(serializedRecording);
};

export const parsePoseDetectionRecording = (serializedRecording: string) =>
	parseSerializedRecording(PoseDetectionRecording, serializedRecording);

export const serializePoseDetectionRecording = (
	recording: PoseDetectionRecording,
) => serializeCheckedRecording(PoseDetectionRecording, recording);

export const copyPoseDetectionRecording = (
	recording: PoseDetectionRecording,
) => {
	const serializedRecording = serializePoseDetectionRecording(recording);
	return parsePoseDetectionRecording(serializedRecording);
};

export type PoseRecorderStatus = "idle" | "recording" | "stopped" | "full";

const createRecorder = <Frame, Recording>(
	recorderSettings: { maxFrames?: number },
	decode: (candidateFrame: unknown) => Frame,
	copy: (recording: {
		version: 1;
		frames: Array<{ timestampMs: number; frame: Frame }>;
	}) => Recording,
) => {
	const defaultFrameCapacity = 1800;
	const frameCapacity = recorderSettings.maxFrames ?? defaultFrameCapacity;
	const isCapacityValid =
		Number.isInteger(frameCapacity) &&
		frameCapacity >= 1 &&
		frameCapacity <= MAXIMUM_FRAMES;
	if (!isCapacityValid)
		throw new RangeError("maxFrames must be an integer from 1 to 10000");

	const emptyRecordingCharacters = JSON.stringify({
		version: RECORDING_VERSION,
		frames: [],
	}).length;
	let status: PoseRecorderStatus = "idle";
	let frames: Array<{ timestampMs: number; frame: Frame }> = [];
	let startedAt: number | undefined;
	let previousTimestamp = -1;
	let serializedCharacters = emptyRecordingCharacters;
	return {
		get status() {
			return status;
		},
		get frameCount() {
			return frames.length;
		},
		start() {
			frames = [];
			startedAt = undefined;
			previousTimestamp = -1;
			serializedCharacters = emptyRecordingCharacters;
			status = "recording";
		},
		append(frame: Frame, now = performance.now()): boolean {
			const isRecording = status === "recording";
			if (!isRecording) return false;

			const isTimeInvalid = !Number.isFinite(now) || now < 0;
			if (isTimeInvalid)
				throw new RangeError("Recording time must be finite and non-negative");

			const origin = startedAt ?? now;
			const timestampMs = now - origin;
			const isOutOfOrder = timestampMs <= previousTimestamp;
			if (isOutOfOrder)
				throw new RangeError("Recording timestamps must strictly increase");

			const isTooLong = timestampMs > MAXIMUM_RECORDING_MILLISECONDS;
			if (isTooLong) throw new RangeError("Recordings cannot exceed 24 hours");

			const snapshot = { timestampMs, frame: decode(frame) };
			const serializedEntry = JSON.stringify(snapshot);
			const isFirstEntry = frames.length === 0;
			const separatorCharacters = isFirstEntry ? 0 : 1;
			const nextSerializedCharacters =
				serializedCharacters + separatorCharacters + serializedEntry.length;
			const isOverLimit =
				nextSerializedCharacters > MAXIMUM_SERIALIZED_CHARACTERS;
			if (isOverLimit)
				throw new RangeError(
					"Recording JSON exceeds 64 Mi characters; stop to retrieve captured frames",
				);

			frames.push(snapshot);
			serializedCharacters = nextSerializedCharacters;
			startedAt = origin;
			previousTimestamp = timestampMs;
			const isFull = frames.length === frameCapacity;
			if (isFull) status = "full";
			return true;
		},
		stop(): Recording {
			const recording = copy({ version: RECORDING_VERSION, frames });
			const isRecording = status === "recording";
			if (isRecording) status = "stopped";
			return recording;
		},
	};
};

export const createPoseRecorder = (
	recorderSettings: { maxFrames?: number } = {},
) =>
	createRecorder<PoseFrame, PoseRecording>(
		recorderSettings,
		decodeFrame,
		copyPoseRecording,
	);

export const createPoseDetectionRecorder = (
	recorderSettings: { maxFrames?: number } = {},
) =>
	createRecorder<PoseDetection, PoseDetectionRecording>(
		recorderSettings,
		decodeDetection,
		copyPoseDetectionRecording,
	);
