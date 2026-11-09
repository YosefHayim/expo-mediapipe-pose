import {
	Landmark,
	type PoseLandmarks,
	PoseResults,
	parsePoseDetectionRecording,
	parsePoseRecording,
} from "expo-mediapipe-pose/core";
import { z } from "zod";
import type { BrowserFrame } from "./types";

const positive = z.number().positive();
const frameSchema = z.strictObject({
	landmarks: z.array(Landmark).max(33),
	worldLandmarks: z.array(Landmark).max(33),
	poses: PoseResults,
	imageSize: z.strictObject({ width: positive, height: positive }),
	inferenceDurationMs: z.number().nonnegative(),
});
const recordingSchema = z
	.strictObject({
		format: z.literal("pose-playground"),
		version: z.literal(1),
		frames: z
			.array(
				z.strictObject({
					timestampMs: z.number().min(0).max(86400000),
					frame: frameSchema,
				}),
			)
			.max(1800),
	})
	.refine(
		(recording) =>
			(recording.frames.length === 0 ||
				recording.frames[0]?.timestampMs === 0) &&
			recording.frames.every(
				(entry, i) =>
					i === 0 ||
					entry.timestampMs > (recording.frames[i - 1]?.timestampMs ?? 0),
			),
	);
export type Recording = z.infer<typeof recordingSchema>;
export const MAX_RECORDING_FRAMES = 1800;
export function parseRecording(json: string): Recording {
	if (json.length > 16 * 1024 * 1024)
		throw new Error("Recording exceeds the playground's 16 MiB limit.");
	const data: unknown = JSON.parse(json);
	if (typeof data === "object" && data !== null && "format" in data)
		return recordingSchema.parse(data);
	let frames: Array<{ timestampMs: number; frame: BrowserFrame }>;
	try {
		const native = parsePoseRecording(json);
		frames = native.frames.map(({ timestampMs, frame }) => ({
			timestampMs,
			frame: {
				landmarks: frame.landmarks,
				worldLandmarks: frame.worldLandmarks,
				poses: nativePoseResults(frame),
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
				poses: nativePoseResults(frame),
				imageSize: frame.imageSize,
				inferenceDurationMs: frame.inferenceDurationMs,
			},
		}));
	}
	return recordingSchema.parse({
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

function nativePoseResults(
	frame: Pick<BrowserFrame, "landmarks" | "worldLandmarks"> & {
		poses?: readonly PoseLandmarks[];
	},
): PoseLandmarks[] {
	if (frame.poses !== undefined) return [...frame.poses];
	if (frame.landmarks.length === 0) return [];
	return [{ landmarks: frame.landmarks, worldLandmarks: frame.worldLandmarks }];
}
export const RECORDING_ENVELOPE_BYTES = JSON.stringify({
	format: "pose-playground",
	version: 1,
	frames: [],
}).length;
