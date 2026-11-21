import { describe, expect, test, vi } from "vitest";
import { readPosePhoto, readPoseVideo } from "./read-pose-file";

vi.mock("expo", function mockExpo() {
	function requireNativeModule() {
		throw new Error("native missing");
	}

	return { requireNativeModule };
});

function readPosePhotoTests() {
	test("a missing photo fails with its path", rejectsAnEmptyPhoto);
	test(
		"an unknown model tells the app which models it can run",
		rejectsAnUnknownModel,
	);
	test(
		"reading a photo outside a development build says Expo Go cannot load it",
		needsADevelopmentBuild,
	);
}

function readPoseVideoTests() {
	test(
		"a video frame rate outside 1 to 60 fails before the file opens",
		rejectsABadSampleRate,
	);
}

describe("readPosePhoto", readPosePhotoTests);
describe("readPoseVideo", readPoseVideoTests);

async function rejectsAnEmptyPhoto() {
	await expect(readEmptyPhoto()).rejects.toThrow(
		"Could not read a pose from .",
	);
}

function readEmptyPhoto() {
	return readPosePhoto({ path: "" });
}

async function rejectsAnUnknownModel() {
	await expect(readTinyModel()).rejects.toThrow(
		'Unknown pose model. Use "lite", "full", or "heavy".',
	);
}

function readTinyModel() {
	return readPosePhoto({ path: "pose.jpg", poseModel: "tiny" });
}

async function needsADevelopmentBuild() {
	await expect(readPhotoWithoutNative()).rejects.toThrow(
		"This needs a development build. Expo Go cannot load the pose camera.",
	);
}

function readPhotoWithoutNative() {
	return readPosePhoto({ path: "pose.jpg" });
}

async function rejectsABadSampleRate() {
	await expect(readVideoTooFast()).rejects.toThrow(
		"Frame rate must be a whole number from 1 to 60.",
	);
}

function readVideoTooFast() {
	return readPoseVideo({ path: "pose.mp4", sampleFrameRate: 0 });
}
