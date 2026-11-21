import { describe, expect, test } from "vitest";
import { LANDMARK_NAMES, type LandmarkName } from "@/landmarks/landmark-names";
import {
	type LandmarkPoint,
	type PoseFrame,
	readPoseFrame,
} from "@/landmarks/pose-frame";
import { listPoseBones, type PoseBones } from "./pose-bones";
import type { SkeletonJointChoice, SkeletonRendering } from "./skeleton-joints";

const SKELETON_COLOR = "#38bdf8";

function listPoseBonesTests() {
	test(
		"the skeleton draws a visible arm and leaves out a wrist the camera barely sees",
		drawsAVisibleArm,
	);
	test(
		"a hidden wrist stays on the pose and leaves the drawing",
		hidesAChosenWrist,
	);
	test(
		"a colored shoulder paints its bone and an unlisted elbow stays the skeleton color",
		colorsTheShoulder,
	);
	test("a joint listed twice is refused", refusesARepeatedJoint);
	test("an unknown joint name is refused", refusesAnUnknownJoint);
	test('a joint is "shown" or "hidden"', refusesABadShownValue);
}

describe("listPoseBones", listPoseBonesTests);

function drawsAVisibleArm() {
	const bones = drawArm(0.2, []);
	const boneNames = bones.lines.map(readBoneName);
	const jointNames = bones.joints.map(readJointName);
	const shoulder = bones.joints.find(isLeftShoulder);

	expect(boneNames).toContain("leftShoulder:leftElbow");
	expect(boneNames).not.toContain("leftElbow:leftWrist");
	expect(jointNames).toContain("leftShoulder");
	expect(jointNames).not.toContain("leftWrist");
	expect(shoulder?.x).toBe(25);
	expect(shoulder?.color).toBe(SKELETON_COLOR);
}

function hidesAChosenWrist() {
	const poseFrame = readArmFrame(1);
	const bones = drawPose(poseFrame, [
		{ landmarkName: "leftWrist", shown: "hidden" },
	]);
	const boneNames = bones.lines.map(readBoneName);
	const jointNames = bones.joints.map(readJointName);

	expect(boneNames).toContain("leftShoulder:leftElbow");
	expect(boneNames).not.toContain("leftElbow:leftWrist");
	expect(jointNames).not.toContain("leftWrist");
	expect(poseFrame.landmarks.leftWrist).not.toBeNull();
}

function colorsTheShoulder() {
	const bones = drawArm(1, [
		{ landmarkName: "leftShoulder", color: "#f97316" },
	]);
	const shoulder = bones.joints.find(isLeftShoulder);
	const elbow = bones.joints.find(isLeftElbow);
	const upperArm = bones.lines.find(isUpperArm);

	expect(shoulder?.color).toBe("#f97316");
	expect(elbow?.color).toBe(SKELETON_COLOR);
	expect(upperArm?.color).toBe("#f97316");
}

function refusesARepeatedJoint() {
	function drawTwice() {
		drawArm(1, [
			{ landmarkName: "leftWrist", shown: "hidden" },
			{ landmarkName: "leftWrist", color: "#f97316" },
		]);
	}

	expect(drawTwice).toThrow("The skeleton lists leftWrist twice.");
}

function refusesAnUnknownJoint() {
	const unknownJoint = {
		landmarkName: "toe" as LandmarkName,
	};

	function drawUnknownJoint() {
		drawArm(1, [unknownJoint]);
	}

	expect(drawUnknownJoint).toThrow('Unknown landmark "toe".');
}

function refusesABadShownValue() {
	const badJoint = {
		landmarkName: "nose" as const,
		shown: "maybe" as SkeletonRendering,
	};

	function drawBadJoint() {
		drawArm(1, [badJoint]);
	}

	expect(drawBadJoint).toThrow('A skeleton joint is "shown" or "hidden".');
}

function drawArm(
	wristVisibility: number,
	skeletonJoints: readonly SkeletonJointChoice[],
): PoseBones {
	return drawPose(readArmFrame(wristVisibility), skeletonJoints);
}

function drawPose(
	poseFrame: PoseFrame,
	skeletonJoints: readonly SkeletonJointChoice[],
): PoseBones {
	const viewWidth = 100;
	const viewHeight = 100;

	return listPoseBones({
		poseFrame,
		viewWidth,
		viewHeight,
		skeletonColor: SKELETON_COLOR,
		skeletonJoints,
	});
}

function readArmFrame(wristVisibility: number): PoseFrame {
	const poseFrame = readPoseFrame({
		landmarks: jointsNamed({
			leftShoulder: joint(0.25, 1),
			leftElbow: joint(0.5, 1),
			leftWrist: joint(0.75, wristVisibility),
		}),
		worldLandmarks: jointsNamed({}),
		poses: [],
		imageSize: { width: 100, height: 100 },
	});
	const isFrameMissing = poseFrame == null;

	if (isFrameMissing) throw new Error("The pose for the skeleton was empty.");

	return poseFrame;
}

function joint(x: number, visibility: number): LandmarkPoint {
	return { x, y: 0.5, z: 0, visibility, presence: 1 };
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

function readBoneName(line: { name: string }) {
	return line.name;
}

function readJointName(jointPoint: { name: string }) {
	return jointPoint.name;
}

function isLeftShoulder(jointPoint: { name: string }) {
	return jointPoint.name == "leftShoulder";
}

function isLeftElbow(jointPoint: { name: string }) {
	return jointPoint.name == "leftElbow";
}

function isUpperArm(line: { name: string }) {
	return line.name == "leftShoulder:leftElbow";
}
