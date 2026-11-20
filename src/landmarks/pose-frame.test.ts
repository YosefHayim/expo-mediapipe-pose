import { describe, expect, test } from "vitest";
import { LANDMARK_NAMES } from "./landmark-names";
import {
	type LandmarkPoint,
	placeLandmarkInView,
	pointInImage,
	readPoseFrame,
} from "./pose-frame";

const visiblePoint: LandmarkPoint = {
	x: 0.25,
	y: 0.5,
	z: -0.1,
	visibility: 0.9,
	presence: 0.8,
};

function readPoseFrameTests() {
	test(
		"names the first pose and keeps a missing joint empty",
		namesTheFirstPose,
	);
	test("returns null when the event is unreadable", returnsNullWhenUnreadable);
	test("uses zero for a still photo clock", usesZeroForAStillPhoto);
	test("reads a sampled video step", readsASampledVideoStep);
}

function pointInImageTests() {
	test(
		"multiplies normalized coordinates by the image size",
		multipliesByImage,
	);
}

function placeLandmarkInViewTests() {
	test("covers the view and centers the image", coversTheView);
	test("rejects a zero view size", rejectsAZeroView);
}

describe("readPoseFrame", readPoseFrameTests);
describe("pointInImage", pointInImageTests);
describe("placeLandmarkInView", placeLandmarkInViewTests);

function namesTheFirstPose() {
	const landmarks = emptyNativePoints();
	landmarks[0] = visiblePoint;
	const firstPoseLandmarks = emptyNativePoints();
	firstPoseLandmarks[0] = { ...visiblePoint, x: 0.7 };
	const secondPoseLandmarks = emptyNativePoints();
	secondPoseLandmarks[15] = visiblePoint;

	const poseFrame = readPoseFrame({
		landmarks,
		worldLandmarks: emptyNativePoints(),
		poses: [
			{
				landmarks: firstPoseLandmarks,
				worldLandmarks: emptyNativePoints(),
			},
			{
				landmarks: secondPoseLandmarks,
				worldLandmarks: emptyNativePoints(),
			},
		],
		additionalData: {
			width: 100,
			height: 200,
			cameraFacing: "front",
			receivedAtMs: 15,
		},
	});

	expect(poseFrame?.landmarks.nose?.x).toBe(0.7);
	expect(poseFrame?.landmarks.leftWrist).toBeNull();
	expect(poseFrame?.poses[1]?.landmarks.leftWrist?.x).toBe(0.25);
	expect(poseFrame?.timestampMs).toBe(15);
	expect(poseFrame?.cameraFacing).toBe("front");
	expect(poseFrame?.imageWidth).toBe(100);
}

function returnsNullWhenUnreadable() {
	const missingVisibility = emptyNativePoints();
	missingVisibility[0] = { x: 0.1, y: 0.2, z: 0, presence: 1 };

	const poseFrame = readPoseFrame({
		landmarks: missingVisibility,
		worldLandmarks: emptyNativePoints(),
		poses: [],
		additionalData: {
			width: 10,
			height: 10,
			cameraFacing: "back",
			receivedAtMs: 4,
		},
	});

	expect(readPoseFrame(null)).toBeNull();
	expect(readPoseFrame({ landmarks: "nope" })).toBeNull();
	expect(poseFrame?.landmarks.nose).toBeNull();
	expect(poseFrame?.cameraFacing).toBe("back");
}

function usesZeroForAStillPhoto() {
	const poseFrame = readPoseFrame({
		landmarks: emptyNativePoints(),
		worldLandmarks: emptyNativePoints(),
		imageSize: { width: 8, height: 4 },
	});

	expect(poseFrame?.timestampMs).toBe(0);
	expect(poseFrame?.cameraFacing).toBeNull();
	expect(poseFrame?.imageHeight).toBe(4);
	expect(poseFrame?.landmarks.nose).toBeNull();
	expect(LANDMARK_NAMES).toHaveLength(33);
}

function readsASampledVideoStep() {
	const poseFrame = readPoseFrame({
		timestampMs: 40,
		detection: {
			landmarks: [visiblePoint],
			worldLandmarks: [visiblePoint],
			imageSize: { width: 4, height: 5 },
		},
	});

	expect(poseFrame?.timestampMs).toBe(40);
	expect(poseFrame?.landmarks.nose).toEqual(visiblePoint);
	expect(poseFrame?.worldLandmarks.nose?.z).toBe(-0.1);
	expect(poseFrame?.cameraFacing).toBeNull();
}

function multipliesByImage() {
	const imagePoint = pointInImage(visiblePoint, 200, 80);

	expect(imagePoint).toEqual({ x: 50, y: 40 });
}

function coversTheView() {
	const placed = placeLandmarkInView(
		visiblePoint,
		{ width: 100, height: 100 },
		{ width: 100, height: 200 },
	);

	expect(placed).toEqual({ x: 0, y: 100 });
}

function rejectsAZeroView() {
	expect(() =>
		placeLandmarkInView(
			visiblePoint,
			{ width: 100, height: 100 },
			{ width: 0, height: 200 },
		),
	).toThrow(RangeError);
}

function emptyNativePoints(): unknown[] {
	const points: unknown[] = [];

	for (let index = 0; index < LANDMARK_NAMES.length; index += 1) {
		points.push(null);
	}

	return points;
}
