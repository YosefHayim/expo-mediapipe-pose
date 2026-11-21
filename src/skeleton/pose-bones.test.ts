import { describe, expect, test } from "vitest";
import { LANDMARK_NAMES, type LandmarkName } from "../landmarks/landmark-names";
import { type LandmarkPoint, readPoseFrame } from "../landmarks/pose-frame";
import { listPoseBones } from "./pose-bones";

function listPoseBonesTests() {
	test(
		"the skeleton draws a visible arm and leaves out a wrist the camera barely sees",
		drawsAVisibleArm,
	);
}

describe("listPoseBones", listPoseBonesTests);

function drawsAVisibleArm() {
	const poseFrame = readPoseFrame({
		landmarks: jointsNamed({
			leftShoulder: joint(0.25, 1),
			leftElbow: joint(0.5, 1),
			leftWrist: joint(0.75, 0.2),
		}),
		worldLandmarks: jointsNamed({}),
		poses: [],
		imageSize: { width: 100, height: 100 },
	});
	const isFrameMissing = poseFrame == null;

	if (isFrameMissing) throw new Error("The pose for the skeleton was empty.");

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
	return jointPoint.name === "leftShoulder";
}
