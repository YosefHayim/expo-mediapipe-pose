import {
	Landmark,
	type PoseLandmarks,
	parsePoseDetectionRecording,
	parsePoseRecording,
} from "expo-mediapipe-pose/core";
import { z } from "zod";
import type { BrowserFrame } from "./types";

const MAXIMUM_LANDMARKS = 33;
const MAXIMUM_POSES = 6;
export const MAX_RECORDING_FRAMES = 1800;
const positive = z.number().positive();
const strictLandmark = z.strictObject(Landmark.shape);
const strictPoseLandmarks = z.strictObject({
	landmarks: z.array(strictLandmark).max(MAXIMUM_LANDMARKS),
	worldLandmarks: z.array(strictLandmark).max(MAXIMUM_LANDMARKS),
});
const strictPoseResults = z.array(strictPoseLandmarks).max(MAXIMUM_POSES);
const frameSchema = z.strictObject({
	...strictPoseLandmarks.shape,
	poses: strictPoseResults,
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
			.max(MAX_RECORDING_FRAMES),
	})
	.refine(
		(recording) =>
			(recording.frames.length === 0 ||
				recording.frames[0]?.timestampMs === 0) &&
			recording.frames.every(
				(recordedFrame, index) =>
					index === 0 ||
					recordedFrame.timestampMs >
						(recording.frames[index - 1]?.timestampMs ?? 0),
			),
	);
export type Recording = z.infer<typeof recordingSchema>;
export const parseRecording = (serializedRecording: string): Recording => {
	const isTooLarge = serializedRecording.length > 16 * 1024 * 1024;
	if (isTooLarge)
		throw new Error("Recording exceeds the playground's 16 MiB limit.");

	const parsedRecording: unknown = JSON.parse(serializedRecording);

	const isPlaygroundFormat =
		typeof parsedRecording === "object" &&
		parsedRecording !== null &&
		"format" in parsedRecording;
	if (isPlaygroundFormat) return recordingSchema.parse(parsedRecording);

	let frames: Array<{ timestampMs: number; frame: BrowserFrame }>;
	try {
		const native = parsePoseRecording(serializedRecording);
		frames = native.frames.map(({ timestampMs, frame }) => ({
			timestampMs,
			frame: {
				landmarks: frame.landmarks,
				worldLandmarks: frame.worldLandmarks,
				poses: listNativePoses(frame),
				imageSize: {
					width: frame.additionalData.width,
					height: frame.additionalData.height,
				},
				inferenceDurationMs: frame.additionalData.inferenceDurationMs,
			},
		}));
	} catch {
		const native = parsePoseDetectionRecording(serializedRecording);
		frames = native.frames.map(({ timestampMs, frame }) => ({
			timestampMs,
			frame: {
				landmarks: frame.landmarks,
				worldLandmarks: frame.worldLandmarks,
				poses: listNativePoses(frame),
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
};
export const readFrameAt = (recording: Recording, timestampMs: number) => {
	let index = 0;
	for (let i = 1; i < recording.frames.length; i++) {
		const isNextFrameAfterTimestamp =
			(recording.frames[i]?.timestampMs ?? Infinity) > timestampMs;
		if (isNextFrameAfterTimestamp) break;

		index = i;
	}
	return recording.frames[index]?.frame ?? null;
};
export const download = (name: string, contents: string) => {
	const url = URL.createObjectURL(
		new Blob([contents], { type: "application/json" }),
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = name;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const listNativePoses = (
	frame: Pick<BrowserFrame, "landmarks" | "worldLandmarks"> & {
		poses?: readonly PoseLandmarks[];
	},
): PoseLandmarks[] => {
	const hasFramePoses = frame.poses !== undefined;
	if (hasFramePoses) return [...frame.poses];

	const isFrameLandmarksEmpty = frame.landmarks.length === 0;
	if (isFrameLandmarksEmpty) return [];

	return [{ landmarks: frame.landmarks, worldLandmarks: frame.worldLandmarks }];
};
export const RECORDING_ENVELOPE_BYTES = JSON.stringify({
	format: "pose-playground",
	version: 1,
	frames: [],
}).length;
