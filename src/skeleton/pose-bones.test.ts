import { describe, expect, test } from "vitest";
import { LANDMARK_NAMES } from "../landmarks/landmark-names";
import { type LandmarkPoint, readPoseFrame } from "../landmarks/pose-frame";
import { listPoseBones } from "./pose-bones";

function listPoseBonesTests() {
	test("draws a visible bone and skips a faint joint", drawsAVisibleBone);
}

describe("listPoseBones", listPoseBonesTests);

function drawsAVisibleBone() {
	const points: Array<LandmarkPoint | null> = [];

	for (let index = 0; index < LANDMARK_NAMES.length; index += 1) {
		points.push(null);
	}

	const shoulderIndex = LANDMARK_NAMES.indexOf("leftShoulder");
	const elbowIndex = LANDMARK_NAMES.indexOf("leftElbow");
	const wristIndex = LANDMARK_NAMES.indexOf("leftWrist");
	points[shoulderIndex] = joint(0.25, 1);
	points[elbowIndex] = joint(0.5, 1);
	points[wristIndex] = joint(0.75, 0.2);

	const poseFrame = readPoseFrame({
		landmarks: points,
		worldLandmarks: points,
		poses: [],
		imageSize: { width: 100, height: 100 },
	});

	if (poseFrame == null) throw new Error("Expected a pose frame");

	const bones = listPoseBones({
		poseFrame,
		viewWidth: 100,
		viewHeight: 100,
	});
	const boneNames = bones.lines.map(readBoneName);
	const jointNames = bones.joints.map(readJointName);

	expect(boneNames).toContain("leftShoulder:leftElbow");
	expect(boneNames).not.toContain("leftElbow:leftWrist");
	expect(jointNames).toContain("leftShoulder");
	expect(jointNames).not.toContain("leftWrist");
	expect(bones.joints.find(isLeftShoulder)?.x).toBe(25);
}

function joint(x: number, visibility: number): LandmarkPoint {
	return { x, y: 0.5, z: 0, visibility, presence: 1 };
}

function readBoneName(line: { name: string }) {
	return line.name;
}

function readJointName(jointPoint: { name: string }) {
	return jointPoint.name;
}

function isLeftShoulder(jointPoint: { name: string }) {
	return jointPoint.name === "leftShoulder";
}
