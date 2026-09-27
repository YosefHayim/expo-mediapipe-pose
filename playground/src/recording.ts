import { Schema } from "effect";
import {
	Landmark,
	PoseResults,
	parsePoseDetectionRecording,
	parsePoseRecording,
} from "expo-mediapipe-pose/core";
import type { BrowserFrame } from "./types";

const positive = Schema.Number.pipe(Schema.finite(), Schema.positive());
const frameSchema = Schema.Struct({
	landmarks: Schema.mutable(Schema.Array(Landmark).pipe(Schema.maxItems(33))),
	worldLandmarks: Schema.mutable(
		Schema.Array(Landmark).pipe(Schema.maxItems(33)),
	),
	poses: Schema.mutable(PoseResults),
	imageSize: Schema.Struct({ width: positive, height: positive }),
	inferenceDurationMs: Schema.Number.pipe(
		Schema.finite(),
		Schema.nonNegative(),
	),
});
const recordingSchema = Schema.Struct({
	format: Schema.Literal("pose-playground"),
	version: Schema.Literal(1),
	frames: Schema.Array(
		Schema.Struct({
			timestampMs: Schema.Number.pipe(
				Schema.finite(),
				Schema.between(0, 86400000),
			),
			frame: frameSchema,
		}),
	).pipe(Schema.maxItems(1800)),
}).pipe(
	Schema.filter(
		(recording) =>
			(recording.frames.length === 0 ||
				recording.frames[0]?.timestampMs === 0) &&
			recording.frames.every(
				(entry, i) =>
					i === 0 ||
					entry.timestampMs > (recording.frames[i - 1]?.timestampMs ?? 0),
			),
	),
);
export type Recording = Schema.Schema.Type<typeof recordingSchema>;
export const MAX_RECORDING_FRAMES = 1800;
export function parseRecording(json: string): Recording {
	if (json.length > 16 * 1024 * 1024)
		throw new Error("Recording exceeds the playground's 16 MiB limit.");
	const data: unknown = JSON.parse(json);
	if (typeof data === "object" && data !== null && "format" in data)
		return Schema.decodeUnknownSync(recordingSchema, {
			onExcessProperty: "error",
		})(data);
	let frames: Array<{ timestampMs: number; frame: BrowserFrame }>;
	try {
		const native = parsePoseRecording(json);
		frames = native.frames.map(({ timestampMs, frame }) => ({
			timestampMs,
			frame: {
				landmarks: frame.landmarks,
				worldLandmarks: frame.worldLandmarks,
				poses: [
					...(frame.poses ?? [
						{
							landmarks: frame.landmarks,
							worldLandmarks: frame.worldLandmarks,
						},
					]),
				],
				imageSize: {
					width: frame.additionalData.width,
					height: frame.additionalData.height,
				},
				inferenceDurationMs: frame.additionalData.inferenceDurationMs,
			},
		}));
	} catch {
		const native = parsePoseDetectionRecording(json);
		frames = native.frames.map(({ timestampMs, frame }) => ({
			timestampMs,
			frame: {
				landmarks: frame.landmarks,
				worldLandmarks: frame.worldLandmarks,
				poses: [
					...(frame.poses ?? [
						{
							landmarks: frame.landmarks,
							worldLandmarks: frame.worldLandmarks,
						},
					]),
				],
				imageSize: frame.imageSize,
				inferenceDurationMs: frame.inferenceDurationMs,
			},
		}));
	}
	return Schema.decodeUnknownSync(recordingSchema)({
		format: "pose-playground",
		version: 1,
		frames,
	});
}
export function frameAt(recording: Recording, timestampMs: number) {
	let index = 0;
	for (let i = 1; i < recording.frames.length; i++) {
		if ((recording.frames[i]?.timestampMs ?? Infinity) > timestampMs) break;
		index = i;
	}
	return recording.frames[index]?.frame ?? null;
}
export function download(name: string, contents: string) {
	const url = URL.createObjectURL(
		new Blob([contents], { type: "application/json" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
