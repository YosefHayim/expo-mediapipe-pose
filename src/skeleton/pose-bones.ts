import { LANDMARK_NAMES, type LandmarkName } from "../landmarks/landmark-names";
import {
	type LandmarkPoint,
	type PoseFrame,
	placeLandmarkInView,
} from "../landmarks/pose-frame";

const POSE_CONNECTIONS: readonly (readonly [LandmarkName, LandmarkName])[] = [
	["nose", "leftEyeInner"],
	["leftEyeInner", "leftEye"],
	["leftEye", "leftEyeOuter"],
	["leftEyeOuter", "leftEar"],
	["nose", "rightEyeInner"],
	["rightEyeInner", "rightEye"],
	["rightEye", "rightEyeOuter"],
	["rightEyeOuter", "rightEar"],
	["mouthLeft", "mouthRight"],
	["leftShoulder", "rightShoulder"],
	["leftShoulder", "leftElbow"],
	["leftElbow", "leftWrist"],
	["leftWrist", "leftPinky"],
	["leftWrist", "leftIndex"],
	["leftWrist", "leftThumb"],
	["leftPinky", "leftIndex"],
	["rightShoulder", "rightElbow"],
	["rightElbow", "rightWrist"],
	["rightWrist", "rightPinky"],
	["rightWrist", "rightIndex"],
	["rightWrist", "rightThumb"],
	["rightPinky", "rightIndex"],
	["leftShoulder", "leftHip"],
	["rightShoulder", "rightHip"],
	["leftHip", "rightHip"],
	["leftHip", "leftKnee"],
	["leftKnee", "leftAnkle"],
	["leftAnkle", "leftHeel"],
	["leftHeel", "leftFootIndex"],
	["leftAnkle", "leftFootIndex"],
	["rightHip", "rightKnee"],
	["rightKnee", "rightAnkle"],
	["rightAnkle", "rightHeel"],
	["rightHeel", "rightFootIndex"],
	["rightAnkle", "rightFootIndex"],
];

export interface PoseBoneLine {
	name: string;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export interface PoseBoneJoint {
	name: LandmarkName;
	x: number;
	y: number;
}

export interface PoseDrawing {
	poseFrame: PoseFrame;
	viewWidth: number;
	viewHeight: number;
}

export interface PoseBones {
	lines: PoseBoneLine[];
	joints: PoseBoneJoint[];
}

export function listPoseBones(drawing: PoseDrawing): PoseBones {
	const image = {
		width: drawing.poseFrame.imageWidth,
		height: drawing.poseFrame.imageHeight,
	};
	const view = { width: drawing.viewWidth, height: drawing.viewHeight };
	const joints: PoseBoneJoint[] = [];

	for (const landmarkName of LANDMARK_NAMES) {
		const point = drawing.poseFrame.landmarks[landmarkName];
		const isDrawn = isLandmarkDrawn(point);

		if (!isDrawn) continue;

		const placed = placeLandmarkInView(point, image, view);
		joints.push({ name: landmarkName, x: placed.x, y: placed.y });
	}

	const lines: PoseBoneLine[] = [];

	for (const connection of POSE_CONNECTIONS) {
		const line = placeConnection(drawing.poseFrame, image, view, connection);

		if (line == null) continue;

		lines.push(line);
	}

	return { lines, joints };
}

function placeConnection(
	poseFrame: PoseFrame,
	image: { width: number; height: number },
	view: { width: number; height: number },
	connection: readonly [LandmarkName, LandmarkName],
): PoseBoneLine | null {
	const [fromName, toName] = connection;
	const fromPoint = poseFrame.landmarks[fromName];
	const toPoint = poseFrame.landmarks[toName];
	const isFromDrawn = isLandmarkDrawn(fromPoint);

	if (!isFromDrawn) return null;

	const isToDrawn = isLandmarkDrawn(toPoint);

	if (!isToDrawn) return null;

	const fromPlaced = placeLandmarkInView(fromPoint, image, view);
	const toPlaced = placeLandmarkInView(toPoint, image, view);

	return {
		name: `${fromName}:${toName}`,
		x1: fromPlaced.x,
		y1: fromPlaced.y,
		x2: toPlaced.x,
		y2: toPlaced.y,
	};
}

function isLandmarkDrawn(point: LandmarkPoint | null): point is LandmarkPoint {
	const isMissing = point == null;

	if (isMissing) return false;

	const minimumDrawnVisibility = 0.5;
	const isTooFaint = point.visibility < minimumDrawnVisibility;

	if (isTooFaint) return false;

	return true;
}
