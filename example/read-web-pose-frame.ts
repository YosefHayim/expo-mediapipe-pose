import {
	LANDMARK_NAMES,
	type LandmarkName,
	type LandmarkPoint,
	type NamedLandmarks,
	type NamedPose,
	type PoseFrame,
} from "expo-mediapipe-pose";

export interface WebLandmark {
	x: number;
	y: number;
	z: number;
	visibility?: number;
	presence?: number;
}

export interface WebPosePicture {
	landmarks: readonly (readonly WebLandmark[])[];
	worldLandmarks: readonly (readonly WebLandmark[])[];
	timestampMs: number;
	imageWidth: number;
	imageHeight: number;
}

export function readWebPoseFrame(picture: WebPosePicture): PoseFrame {
	const poses = readPoses(picture);
	const firstPose = poses[0];
	const isFirstPoseMissing = firstPose == null;

	if (isFirstPoseMissing) {
		const emptyLandmarks = createEmptyLandmarks();

		return {
			landmarks: emptyLandmarks,
			worldLandmarks: emptyLandmarks,
			poses,
			timestampMs: picture.timestampMs,
			imageWidth: picture.imageWidth,
			imageHeight: picture.imageHeight,
			cameraFacing: "front",
		};
	}

	return {
		landmarks: firstPose.landmarks,
		worldLandmarks: firstPose.worldLandmarks,
		poses,
		timestampMs: picture.timestampMs,
		imageWidth: picture.imageWidth,
		imageHeight: picture.imageHeight,
		cameraFacing: "front",
	};
}

function readPoses(picture: WebPosePicture): NamedPose[] {
	const poses: NamedPose[] = [];
	const personCount = Math.min(
		picture.landmarks.length,
		picture.worldLandmarks.length,
	);

	for (let index = 0; index < personCount; index += 1) {
		const imagePoints = picture.landmarks[index];
		const worldPoints = picture.worldLandmarks[index];
		const isImageMissing = imagePoints == null;

		if (isImageMissing) continue;

		const isWorldMissing = worldPoints == null;

		if (isWorldMissing) continue;

		poses.push({
			landmarks: readNamedLandmarks(imagePoints),
			worldLandmarks: readNamedLandmarks(worldPoints),
		});
	}

	return poses;
}

function readNamedLandmarks(points: readonly WebLandmark[]): NamedLandmarks {
	const named = createEmptyLandmarks();

	for (const [index, landmarkName] of LANDMARK_NAMES.entries()) {
		named[landmarkName] = readWebLandmark(points[index]);
	}

	return named;
}

function readWebLandmark(point: WebLandmark | undefined): LandmarkPoint | null {
	const isMissing = point == null;

	if (isMissing) return null;

	const visibility = readUnitInterval(point.visibility);

	if (visibility == null) return null;

	const reportedPresence = readUnitInterval(point.presence);
	const presence = reportedPresence ?? visibility;

	return {
		x: point.x,
		y: point.y,
		z: point.z,
		visibility,
		presence,
	};
}

function createEmptyLandmarks(): NamedLandmarks {
	const named: Partial<NamedLandmarks> = {};

	for (const landmarkName of LANDMARK_NAMES) {
		named[landmarkName] = null;
	}

	return named as NamedLandmarks;
}

function readUnitInterval(candidate: number | undefined): number | null {
	const isMissing = candidate == null;

	if (isMissing) return null;

	const isFiniteNumber = Number.isFinite(candidate);

	if (!isFiniteNumber) return null;

	const isBelow = candidate < 0;

	if (isBelow) return null;

	const isAbove = candidate > 1;

	if (isAbove) return null;

	return candidate;
}

export function countVisibleJoints(poseFrame: PoseFrame): number {
	function isJointVisible(landmarkName: LandmarkName): boolean {
		return poseFrame.landmarks[landmarkName] != null;
	}

	return LANDMARK_NAMES.filter(isJointVisible).length;
}
