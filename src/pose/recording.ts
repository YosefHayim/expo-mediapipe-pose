import { Schema } from "effect";
import { PoseFrame } from "../contracts";

const maximumFrames = 10_000;
const maximumJsonCharacters = 64 * 1024 * 1024;
const RecordedFrame = PoseFrame.pipe(
	Schema.filter(
		(frame) =>
			frame.landmarks.length <= 33 && frame.worldLandmarks.length <= 33,
	),
);
export const PoseRecording = Schema.Struct({
	version: Schema.Literal(1),
	frames: Schema.Array(
		Schema.Struct({
			timestampMs: Schema.Number.pipe(
				Schema.finite(),
				Schema.between(0, 86_400_000),
			),
			frame: RecordedFrame,
		}),
	).pipe(Schema.maxItems(maximumFrames)),
}).pipe(
	Schema.filter((recording) => {
		if (recording.frames.length === 0) return true;
		if (recording.frames[0]?.timestampMs !== 0) return false;
		return recording.frames.every((entry, index) => {
			if (index === 0) return true;
			const previous = recording.frames[index - 1];
			return previous !== undefined && entry.timestampMs > previous.timestampMs;
		});
	}),
);
export type PoseRecording = Schema.Schema.Type<typeof PoseRecording>;
const decodeRecording = Schema.decodeUnknownSync(PoseRecording, {
	onExcessProperty: "error",
});
const decodeFrame = Schema.decodeUnknownSync(RecordedFrame, {
	onExcessProperty: "error",
});

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
	const capacity = options.maxFrames ?? 1800;
	if (!Number.isInteger(capacity) || capacity < 1 || capacity > maximumFrames)
		throw new RangeError("maxFrames must be an integer from 1 to 10000");
	let status: PoseRecorderStatus = "idle";
	let frames: Array<PoseRecording["frames"][number]> = [];
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
		append(frame: PoseFrame, now = performance.now()): boolean {
			if (status !== "recording") return false;
			if (!Number.isFinite(now) || now < 0)
				throw new RangeError("Recording time must be finite and non-negative");
			const origin = startedAt ?? now;
			const timestampMs = now - origin;
			if (timestampMs <= previousTimestamp)
				throw new RangeError("Recording timestamps must strictly increase");
			if (timestampMs > 86_400_000)
				throw new RangeError("Recordings cannot exceed 24 hours");
			const snapshot = { timestampMs, frame: decodeFrame(frame) };
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
		stop(): PoseRecording {
			const recording = copyPoseRecording({ version: 1, frames });
			if (status === "recording") status = "stopped";
			return recording;
		},
	};
}
