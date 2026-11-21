import { describe, expect, test } from "vitest";
import { listSampleTimestamps } from "./video-sample";

function listSampleTimestampsTests() {
	test(
		"a one second video at 5 frames per second is posed five times and not at the end",
		samplesOneSecond,
	);
	test(
		"a long video tells the app to lower the rate instead of posing every frame",
		rejectsAVideoThatWouldPoseTooMuch,
	);
}

describe("listSampleTimestamps", listSampleTimestampsTests);

function samplesOneSecond() {
	const timestamps = listSampleTimestamps(1000, 5);

	expect(timestamps).toEqual([0, 200, 400, 600, 800]);
}

function rejectsAVideoThatWouldPoseTooMuch() {
	function sampleTooManyFrames() {
		return listSampleTimestamps(16001, 60);
	}

	expect(sampleTooManyFrames).toThrow(
		"This video would pose too many frames. Lower sampleFrameRate.",
	);
}
