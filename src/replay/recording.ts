import { z } from "zod";
import { createPoseFrameFields, type PoseFrame } from "../contracts";
import {
	createPoseDetectionFields,
	type PoseDetection,
} from "../image/analysis";

const maximumFrames = 10_000;
const maximumJsonCharacters = 64 * 1024 * 1024;
const RecordedFrame = z
	.strictObject(createPoseFrameFields(true))
	.refine(
		(frame) =>
			frame.landmarks.length <= 33 && frame.worldLandmarks.length <= 33,
	);
function recordingSchema<FrameSchema extends z.ZodType>(
	frameSchema: FrameSchema,
) {
	return z
		.strictObject({
			version: z.literal(1),
			frames: z
				.array(
					z.strictObject({
						timestampMs: z.number().min(0).max(86_400_000),
						frame: frameSchema,
					}),
				)
				.max(maximumFrames),
		})
		.refine((recording) => {
			if (recording.frames.length === 0) return true;
			if (recording.frames[0]?.timestampMs !== 0) return false;
			return recording.frames.every((entry, index) => {
				if (index === 0) return true;
				const previous = recording.frames[index - 1];
				return (
					previous !== undefined && entry.timestampMs > previous.timestampMs
				);
			});
		});
}
export const PoseRecording = recordingSchema(RecordedFrame);
export type PoseRecording = z.infer<typeof PoseRecording>;
function withoutSegmentation(value: unknown): unknown {
	if (typeof value !== "object" || value === null) return value;
	if (!("segmentation" in value)) return value;
	const { segmentation: _segmentation, ...landmarks } = value;
	return landmarks;
}
const decodeFrame = (value: unknown) =>
	RecordedFrame.parse(withoutSegmentation(value));

export function parsePoseRecording(json: string): PoseRecording {
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return PoseRecording.parse(JSON.parse(json));
}
export function serializePoseRecording(recording: PoseRecording): string {
	const json = JSON.stringify(PoseRecording.parse(recording));
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return json;
}
export function copyPoseRecording(recording: PoseRecording): PoseRecording {
	return parsePoseRecording(serializePoseRecording(recording));
}
export type PoseRecorderStatus = "idle" | "recording" | "stopped" | "full";
export function createPoseRecorder(options: { maxFrames?: number } = {}) {
	return createRecorder<PoseFrame, PoseRecording>(
		options,
		decodeFrame,
		copyPoseRecording,
	);
}
function createRecorder<Frame, Recording>(
	options: { maxFrames?: number },
	decode: (value: unknown) => Frame,
	copy: (recording: {
		version: 1;
		frames: Array<{ timestampMs: number; frame: Frame }>;
	}) => Recording,
) {
	const capacity = options.maxFrames ?? 1800;
	if (!Number.isInteger(capacity) || capacity < 1 || capacity > maximumFrames)
		throw new RangeError("maxFrames must be an integer from 1 to 10000");
	let status: PoseRecorderStatus = "idle";
	let frames: Array<{ timestampMs: number; frame: Frame }> = [];
	let startedAt: number | undefined;
	let previousTimestamp = -1;
	let serializedCharacters = JSON.stringify({ version: 1, frames: [] }).length;
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
			serializedCharacters = JSON.stringify({ version: 1, frames: [] }).length;
			status = "recording";
		},
		append(frame: Frame, now = performance.now()): boolean {
			if (status !== "recording") return false;
			if (!Number.isFinite(now) || now < 0)
				throw new RangeError("Recording time must be finite and non-negative");
			const origin = startedAt ?? now;
			const timestampMs = now - origin;
			if (timestampMs <= previousTimestamp)
				throw new RangeError("Recording timestamps must strictly increase");
			if (timestampMs > 86_400_000)
				throw new RangeError("Recordings cannot exceed 24 hours");
			const snapshot = { timestampMs, frame: decode(frame) };
			const entry = JSON.stringify(snapshot);
			const separatorLength = frames.length === 0 ? 0 : 1;
			const nextSize = serializedCharacters + separatorLength + entry.length;
			if (nextSize > maximumJsonCharacters)
				throw new RangeError(
					"Recording JSON exceeds 64 Mi characters; stop to retrieve captured frames",
				);
			frames.push(snapshot);
			serializedCharacters = nextSize;
			startedAt = origin;
			previousTimestamp = timestampMs;
			if (frames.length === capacity) status = "full";
			return true;
		},
		stop(): Recording {
			const recording = copy({ version: 1, frames });
			if (status === "recording") status = "stopped";
			return recording;
		},
	};
}

const RecordedDetection = z
	.strictObject(createPoseDetectionFields(true))
	.refine(
		(frame) =>
			frame.landmarks.length <= 33 && frame.worldLandmarks.length <= 33,
	);
export const PoseDetectionRecording = recordingSchema(RecordedDetection);
export type PoseDetectionRecording = z.infer<typeof PoseDetectionRecording>;
export function serializePoseDetectionRecording(
	recording: PoseDetectionRecording,
): string {
	const json = JSON.stringify(PoseDetectionRecording.parse(recording));
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return json;
}
export function parsePoseDetectionRecording(
	json: string,
): PoseDetectionRecording {
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return PoseDetectionRecording.parse(JSON.parse(json));
}
export function copyPoseDetectionRecording(
	recording: PoseDetectionRecording,
): PoseDetectionRecording {
	return parsePoseDetectionRecording(
		serializePoseDetectionRecording(recording),
	);
}
export function createPoseDetectionRecorder(
	options: { maxFrames?: number } = {},
) {
	return createRecorder<PoseDetection, PoseDetectionRecording>(
		options,
		(value) => RecordedDetection.parse(withoutSegmentation(value)),
		copyPoseDetectionRecording,
	);
}
