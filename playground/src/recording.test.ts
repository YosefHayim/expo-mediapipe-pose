import type { PoseFrame } from "expo-mediapipe-pose/core";
import { LANDMARK_NAMES } from "expo-mediapipe-pose/core";
import { describe, expect, test } from "vitest";
import { parseRecording, readFrameAt } from "./recording";
import { createSampleBrowserFrame } from "./sample-frame";

const createNativePoseFrame = (): PoseFrame => ({
	landmarks: LANDMARK_NAMES.map(() => ({
		x: 0.5,
		y: 0.5,
		z: 0,
		visibility: 0.9,
	})),
	worldLandmarks: [],
	additionalData: {
		width: 720,
		height: 1280,
		cameraFacing: "front",
		cameraLens: "wide",
		cameraMirrored: true,
		cameraZoomFactor: 1,
		receivedAtMs: 1700000000000,
		frameNumber: 1,
		inferenceDurationMs: 12,
		luminance: 0.5,
		poseCount: 1,
		poseModelDelegate: "GPU",
		poseModelSource: "bundled",
		poseModelVariant: "full",
		thermalState: "nominal",
	},
});

const createTwoFrameRecordingString = (): string => {
	const sampleFrame = createSampleBrowserFrame();

	return JSON.stringify({
		format: "pose-playground",
		version: 1,
		frames: [
			{ timestampMs: 0, frame: sampleFrame },
			{ timestampMs: 100, frame: { ...sampleFrame, inferenceDurationMs: 20 } },
		],
	});
};

describe("parseRecording", () => {
	test("rejects recordings with pixel data or out-of-order frames", () => {
		const recording = parseRecording(createTwoFrameRecordingString());

		expect(() =>
			parseRecording(JSON.stringify({ ...recording, pixels: "private" })),
		).toThrow();
		expect(() =>
			parseRecording(
				JSON.stringify({
					...recording,
					frames: [...recording.frames].reverse(),
				}),
			),
		).toThrow();
	});

	test("replays legacy native frames with no person as zero poses", () => {
		const nativeFrame = createNativePoseFrame();
		const cameraFrame = {
			...nativeFrame,
			landmarks: [],
			worldLandmarks: [],
			additionalData: { ...nativeFrame.additionalData, poseCount: 0 },
		};
		const imageFrame = {
			landmarks: [],
			worldLandmarks: [],
			imageSize: { width: 800, height: 400 },
			inferenceDurationMs: 10,
			model: { variant: "full", source: "bundled", delegate: "CPU" },
		};

		for (const frame of [cameraFrame, imageFrame]) {
			const recording = parseRecording(
				JSON.stringify({ version: 1, frames: [{ timestampMs: 0, frame }] }),
			);

			expect(recording.frames[0]?.frame.poses).toHaveLength(0);
		}
	});
});

describe("frameAt", () => {
	test("returns the frame at or before a time and null when there are no frames", () => {
		const recording = parseRecording(createTwoFrameRecordingString());
		const emptyRecording = parseRecording(
			JSON.stringify({ ...recording, frames: [] }),
		);
		const nativeEmptyRecording = parseRecording(
			JSON.stringify({ version: 1, frames: [] }),
		);

		expect(readFrameAt(recording, 50)?.inferenceDurationMs).toBe(10);
		expect(readFrameAt(recording, 100)?.inferenceDurationMs).toBe(20);
		expect(readFrameAt(emptyRecording, 0)).toBeNull();
		expect(readFrameAt(nativeEmptyRecording, 0)).toBeNull();
	});
});
