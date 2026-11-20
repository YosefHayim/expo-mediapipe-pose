import { describe, expect, test } from "vitest";
import { readFrameRate, readPoseSettings } from "./pose-settings";

function readPoseSettingsTests() {
	test("defaults to the full model on the gpu at 0.5", defaultsToOfficial);
	test("rejects an unknown model", rejectsAnUnknownModel);
	test("rejects a confidence outside 0 to 1", rejectsAConfidence);
	test("rejects a pose count outside 1 to 6", rejectsAPoseCount);
}

function readFrameRateTests() {
	test("keeps a whole rate from 1 to 60", keepsAWholeRate);
	test("rejects a rate outside 1 to 60", rejectsARate);
}

describe("readPoseSettings", readPoseSettingsTests);
describe("readFrameRate", readFrameRateTests);

function defaultsToOfficial() {
	const poseSettings = readPoseSettings({});

	expect(poseSettings).toEqual({
		poseModel: "full",
		poseDelegate: "gpu",
		maxPoseCount: 1,
		minPoseDetectionConfidence: 0.5,
		minPosePresenceConfidence: 0.5,
		minTrackingConfidence: 0.5,
		poseModelPath: null,
	});
}

function rejectsAnUnknownModel() {
	expect(() => readPoseSettings({ poseModel: "tiny" })).toThrow(
		/lite.*full.*heavy/,
	);
}

function rejectsAConfidence() {
	expect(() => readPoseSettings({ minPoseDetectionConfidence: 1.2 })).toThrow(
		/between 0 and 1/,
	);
}

function rejectsAPoseCount() {
	expect(() => readPoseSettings({ maxPoseCount: 7 })).toThrow(/1 to 6/);
}

function keepsAWholeRate() {
	expect(readFrameRate(30)).toBe(30);
}

function rejectsARate() {
	expect(() => readFrameRate(0)).toThrow(/1 to 60/);
	expect(() => readFrameRate(61)).toThrow(/1 to 60/);
	expect(() => readFrameRate(1.5)).toThrow(/1 to 60/);
}
