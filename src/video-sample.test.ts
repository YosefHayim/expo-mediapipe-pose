import { describe, expect, test } from "vitest";
import { listSampleTimestamps } from "./video-sample";

function listSampleTimestampsTests() {
	test("steps across the video without the end timestamp", stepsAcrossTheVideo);
	test("allows one thousand frames", allowsOneThousandFrames);
	test(
		"rejects a video that would pose more than one thousand frames",
		rejectsTooManyFrames,
	);
	test("rejects a duration that is not positive", rejectsABadDuration);
}

describe("listSampleTimestamps", listSampleTimestampsTests);

function stepsAcrossTheVideo() {
	const timestamps = listSampleTimestamps(1000, 5);

	expect(timestamps).toEqual([0, 200, 400, 600, 800]);
}

function allowsOneThousandFrames() {
	const timestamps = listSampleTimestamps(16000, 60);

	expect(timestamps).toHaveLength(1000);
	expect(timestamps[0]).toBe(0);
}

function rejectsTooManyFrames() {
	expect(() => listSampleTimestamps(16001, 60)).toThrow(/sampleFrameRate/);
}

function rejectsABadDuration() {
	expect(() => listSampleTimestamps(0, 5)).toThrow(/duration/);
}
