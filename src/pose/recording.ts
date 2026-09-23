import { Schema } from "effect";
import { PoseFrame } from "../contracts";
import { PoseDetection } from "./imageAnalysis";

const maximumFrames = 10_000;
const maximumJsonCharacters = 64 * 1024 * 1024;
const RecordedFrame = PoseFrame.pipe(Schema.omit("segmentation")).pipe(
	Schema.filter(
		(frame) =>
			frame.landmarks.length <= 33 && frame.worldLandmarks.length <= 33,
	),
);
function recordingSchema<Frame, Encoded>(frame: Schema.Schema<Frame, Encoded>) {
	return Schema.Struct({
		version: Schema.Literal(1),
		frames: Schema.Array(
			Schema.Struct({
				timestampMs: Schema.Number.pipe(
					Schema.finite(),
					Schema.between(0, 86_400_000),
				),
				frame,
			}),
		).pipe(Schema.maxItems(maximumFrames)),
	}).pipe(
		Schema.filter((recording) => {
			if (recording.frames.length === 0) return true;
			if (recording.frames[0]?.timestampMs !== 0) return false;
			return recording.frames.every((entry, index) => {
				if (index === 0) return true;
				const previous = recording.frames[index - 1];
				return (
					previous !== undefined && entry.timestampMs > previous.timestampMs
				);
			});
		}),
	);
}
export const PoseRecording = recordingSchema(RecordedFrame);
export type PoseRecording = Schema.Schema.Type<typeof PoseRecording>;
const decodeRecording = Schema.decodeUnknownSync(PoseRecording, {
	onExcessProperty: "error",
});
function withoutSegmentation(value: unknown): unknown {
	if (typeof value !== "object" || value === null) return value;
	if (!("segmentation" in value)) return value;
	const { segmentation: _segmentation, ...landmarks } = value;
	return landmarks;
}
const decodeFrame = (value: unknown) =>
	Schema.decodeUnknownSync(RecordedFrame, { onExcessProperty: "error" })(
		withoutSegmentation(value),
	);

export function parsePoseRecording(json: string): PoseRecording {
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return decodeRecording(JSON.parse(json));
}
export function serializePoseRecording(recording: PoseRecording): string {
	const json = JSON.stringify(decodeRecording(recording));
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

const RecordedDetection = PoseDetection.pipe(Schema.omit("segmentation")).pipe(
	Schema.filter(
		(frame) =>
			frame.landmarks.length <= 33 && frame.worldLandmarks.length <= 33,
	),
);
export const PoseDetectionRecording = recordingSchema(RecordedDetection);
export type PoseDetectionRecording = Schema.Schema.Type<
	typeof PoseDetectionRecording
>;
const decodeDetectionRecording = Schema.decodeUnknownSync(
	PoseDetectionRecording,
	{ onExcessProperty: "error" },
);
export function serializePoseDetectionRecording(
	recording: PoseDetectionRecording,
): string {
	const json = JSON.stringify(decodeDetectionRecording(recording));
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return json;
}
export function parsePoseDetectionRecording(
	json: string,
): PoseDetectionRecording {
	if (json.length > maximumJsonCharacters)
		throw new RangeError("Recording JSON exceeds 64 Mi characters");
	return decodeDetectionRecording(JSON.parse(json));
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
		(value) =>
			Schema.decodeUnknownSync(RecordedDetection, {
				onExcessProperty: "error",
			})(withoutSegmentation(value)),
		copyPoseDetectionRecording,
	);
}
