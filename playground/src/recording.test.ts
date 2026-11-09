import { describe, expect, test } from "vitest";
import { poseFrame } from "../../src/testing/fixtures";
import { frameAt, parseRecording } from "./recording";
import { createSampleBrowserFrame } from "./sample-frame";

const createTwoFrameRecordingText = (): string => {
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
		const recording = parseRecording(createTwoFrameRecordingText());

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
		const nativeFrame = poseFrame();
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
		const recording = parseRecording(createTwoFrameRecordingText());
		const emptyRecording = parseRecording(
			JSON.stringify({ ...recording, frames: [] }),
		);
		const nativeEmptyRecording = parseRecording(
			JSON.stringify({ version: 1, frames: [] }),
		);

		expect(frameAt(recording, 50)?.inferenceDurationMs).toBe(10);
		expect(frameAt(recording, 100)?.inferenceDurationMs).toBe(20);
		expect(frameAt(emptyRecording, 0)).toBeNull();
		expect(frameAt(nativeEmptyRecording, 0)).toBeNull();
	});
});
