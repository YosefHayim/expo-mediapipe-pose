import { describe, expect, test } from "vitest";
import { LANDMARK_NAMES, type LandmarkName } from "./landmark-names";
import {
	type LandmarkPoint,
	placeLandmarkInView,
	pointInImage,
	readPoseFrame,
} from "./pose-frame";

const visibleWrist: LandmarkPoint = {
	x: 0.25,
	y: 0.5,
	z: -0.1,
	visibility: 0.9,
	presence: 0.8,
};

function readPoseFrameTests() {
	test(
		"an app reads the left wrist by name from the camera joint list",
		readsTheLeftWristByName,
	);
	test(
		"the first person is the pose the app draws and the other stays separate",
		keepsPeopleSeparate,
	);
	test("a photo and a video expose the same joint", readsAPhotoAndAVideo);
	test(
		"a broken camera event is no pose, and a half joint is empty",
		dropsAnUnreadableEvent,
	);
}

function pointInImageTests() {
	test(
		"the wrist pixel in the photo is not the pixel on the preview",
		placesTheWristInThePhoto,
	);
}

function placeLandmarkInViewTests() {
	test(
		"the skeleton covers a tall preview and centers the camera image",
		coversATallPreview,
	);
	test(
		"a preview that has not laid out yet does not invent a position",
		rejectsAnEmptyPreview,
	);
}

describe("readPoseFrame", readPoseFrameTests);
describe("pointInImage", pointInImageTests);
describe("placeLandmarkInView", placeLandmarkInViewTests);

function readsTheLeftWristByName() {
	const mediaPipeLeftWristIndex = 15;
	const poseFrame = readPoseFrame({
		landmarks: jointsAt(mediaPipeLeftWristIndex, visibleWrist),
		worldLandmarks: jointsAt(mediaPipeLeftWristIndex, {
			...visibleWrist,
			z: 0.4,
		}),
		poses: [],
		additionalData: {
			width: 100,
			height: 200,
			cameraFacing: "front",
			receivedAtMs: 15,
		},
	});
	const isFrameMissing = poseFrame == null;

	if (isFrameMissing) throw new Error("The camera frame had no pose.");

	expect(LANDMARK_NAMES[mediaPipeLeftWristIndex]).toBe("leftWrist");
	expect(poseFrame.landmarks.leftWrist).toEqual(visibleWrist);
	expect(poseFrame.landmarks.rightWrist).toBeNull();
	expect(poseFrame.worldLandmarks.leftWrist?.z).toBe(0.4);
	expect(poseFrame.timestampMs).toBe(15);
	expect(poseFrame.cameraFacing).toBe("front");
	expect(poseFrame.imageWidth).toBe(100);
	expect(poseFrame.imageHeight).toBe(200);
}

function keepsPeopleSeparate() {
	const frontNose: LandmarkPoint = { ...visibleWrist, x: 0.2 };
	const backWrist: LandmarkPoint = { ...visibleWrist, x: 0.8 };
	const poseFrame = readPoseFrame({
		landmarks: jointsNamed({ nose: frontNose }),
		worldLandmarks: jointsNamed({}),
		poses: [
			nativePerson({ nose: frontNose }),
			nativePerson({ leftWrist: backWrist }),
		],
		additionalData: {
			width: 100,
			height: 200,
			cameraFacing: "back",
			receivedAtMs: 40,
		},
	});
	const isFrameMissing = poseFrame == null;

	if (isFrameMissing) throw new Error("The camera frame had no pose.");

	expect(poseFrame.landmarks.nose).toEqual(frontNose);
	expect(poseFrame.landmarks.leftWrist).toBeNull();
	expect(poseFrame.poses[1]?.landmarks.leftWrist).toEqual(backWrist);
	expect(poseFrame.poses[0]?.landmarks.leftWrist).toBeNull();
}

function readsAPhotoAndAVideo() {
	const photo = readPoseFrame({
		landmarks: jointsNamed({ leftWrist: visibleWrist }),
		worldLandmarks: jointsNamed({ leftWrist: visibleWrist }),
		imageSize: { width: 200, height: 80 },
	});
	const video = readPoseFrame({
		timestampMs: 40,
		detection: {
			landmarks: jointsNamed({ leftWrist: visibleWrist }),
			worldLandmarks: jointsNamed({ leftWrist: visibleWrist }),
			imageSize: { width: 200, height: 80 },
		},
	});
	const isPhotoMissing = photo == null;

	if (isPhotoMissing) throw new Error("The photo had no pose.");

	const isVideoMissing = video == null;

	if (isVideoMissing) throw new Error("The video frame had no pose.");

	expect(photo.landmarks.leftWrist).toEqual(visibleWrist);
	expect(video.landmarks.leftWrist).toEqual(visibleWrist);
	expect(photo.timestampMs).toBe(0);
	expect(photo.cameraFacing).toBeNull();
	expect(video.timestampMs).toBe(40);
	expect(video.cameraFacing).toBeNull();
}

function dropsAnUnreadableEvent() {
	const halfNose = jointsNamed({});
	halfNose[0] = { x: 0.1, y: 0.2, z: 0, presence: 1 };
	const poseFrame = readPoseFrame({
		landmarks: halfNose,
		worldLandmarks: jointsNamed({}),
		poses: [],
		additionalData: {
			width: 10,
			height: 10,
			cameraFacing: "back",
			receivedAtMs: 4,
		},
	});
	const isFrameMissing = poseFrame == null;

	if (isFrameMissing) throw new Error("A half joint should still be a frame.");

	expect(readPoseFrame(null)).toBeNull();
	expect(readPoseFrame({ landmarks: "nope" })).toBeNull();
	expect(poseFrame.landmarks.nose).toBeNull();
}

function placesTheWristInThePhoto() {
	const photoPixel = pointInImage(visibleWrist, 200, 80);

	expect(photoPixel).toEqual({ x: 50, y: 40 });
}

function coversATallPreview() {
	const previewPixel = placeLandmarkInView(
		visibleWrist,
		{ width: 100, height: 100 },
		{ width: 100, height: 200 },
	);

	expect(previewPixel).toEqual({ x: 0, y: 100 });
}

function rejectsAnEmptyPreview() {
	function placeOnEmptyPreview() {
		return placeLandmarkInView(
			visibleWrist,
			{ width: 100, height: 100 },
			{ width: 0, height: 200 },
		);
	}

	expect(placeOnEmptyPreview).toThrow(RangeError);
}

function jointsAt(index: number, point: LandmarkPoint): unknown[] {
	const points: unknown[] = [];

	for (const [jointIndex] of LANDMARK_NAMES.entries()) {
		const isPlaced = jointIndex === index;
		const stored = isPlaced ? point : null;
		points.push(stored);
	}

	return points;
}

function jointsNamed(
	placedJoints: Partial<Record<LandmarkName, LandmarkPoint>>,
): unknown[] {
	const points: unknown[] = [];

	for (const landmarkName of LANDMARK_NAMES) {
		const point = placedJoints[landmarkName] ?? null;
		points.push(point);
	}

	return points;
}

function nativePerson(
	placedJoints: Partial<Record<LandmarkName, LandmarkPoint>>,
) {
	return {
		landmarks: jointsNamed(placedJoints),
		worldLandmarks: jointsNamed({}),
	};
}
