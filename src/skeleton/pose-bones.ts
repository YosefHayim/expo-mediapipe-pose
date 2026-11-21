import { LANDMARK_NAMES, type LandmarkName } from "@/landmarks/landmark-names";
import {
	type LandmarkPoint,
	type PoseFrame,
	placeLandmarkInView,
	type ViewSize,
} from "@/landmarks/pose-frame";
import {
	readJointLook,
	readSkeletonJointLooks,
	type SkeletonJointChoice,
	type SkeletonJointLook,
} from "./skeleton-joints";

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
	color: string;
}

export interface PoseBoneJoint {
	name: LandmarkName;
	x: number;
	y: number;
	color: string;
}

export interface PoseDrawing {
	poseFrame: PoseFrame;
	viewWidth: number;
	viewHeight: number;
	skeletonColor: string;
	skeletonJoints: readonly SkeletonJointChoice[];
}

export interface PoseBones {
	lines: PoseBoneLine[];
	joints: PoseBoneJoint[];
}

interface PlacedConnection {
	poseFrame: PoseFrame;
	image: ViewSize;
	view: ViewSize;
	connection: readonly [LandmarkName, LandmarkName];
	looks: Map<LandmarkName, SkeletonJointLook>;
	skeletonColor: string;
}

export function listPoseBones(drawing: PoseDrawing): PoseBones {
	const looks = readSkeletonJointLooks(
		drawing.skeletonJoints,
		drawing.skeletonColor,
	);
	const image = {
		width: drawing.poseFrame.imageWidth,
		height: drawing.poseFrame.imageHeight,
	};
	const view = { width: drawing.viewWidth, height: drawing.viewHeight };
	const joints: PoseBoneJoint[] = [];

	for (const landmarkName of LANDMARK_NAMES) {
		const look = readJointLook(looks, landmarkName, drawing.skeletonColor);
		const drawnPoint = readDrawnPoint(
			drawing.poseFrame.landmarks[landmarkName],
			look,
		);
		const isSkipped = drawnPoint == null;

		if (isSkipped) continue;

		const placed = placeLandmarkInView(drawnPoint, image, view);

		joints.push({
			name: landmarkName,
			x: placed.x,
			y: placed.y,
			color: look.color,
		});
	}

	const lines: PoseBoneLine[] = [];

	for (const connection of POSE_CONNECTIONS) {
		const line = placeConnection({
			poseFrame: drawing.poseFrame,
			image,
			view,
			connection,
			looks,
			skeletonColor: drawing.skeletonColor,
		});
		const isLineMissing = line == null;

		if (isLineMissing) continue;

		lines.push(line);
	}

	return { lines, joints };
}

function placeConnection(placed: PlacedConnection): PoseBoneLine | null {
	const [fromName, toName] = placed.connection;
	const fromLook = readJointLook(placed.looks, fromName, placed.skeletonColor);
	const fromPoint = readDrawnPoint(
		placed.poseFrame.landmarks[fromName],
		fromLook,
	);
	const isFromSkipped = fromPoint == null;

	if (isFromSkipped) return null;

	const toLook = readJointLook(placed.looks, toName, placed.skeletonColor);
	const toPoint = readDrawnPoint(placed.poseFrame.landmarks[toName], toLook);
	const isToSkipped = toPoint == null;

	if (isToSkipped) return null;

	const fromPlaced = placeLandmarkInView(fromPoint, placed.image, placed.view);
	const toPlaced = placeLandmarkInView(toPoint, placed.image, placed.view);

	return {
		name: `${fromName}:${toName}`,
		x1: fromPlaced.x,
		y1: fromPlaced.y,
		x2: toPlaced.x,
		y2: toPlaced.y,
		color: fromLook.color,
	};
}

function readDrawnPoint(
	point: LandmarkPoint | null,
	look: SkeletonJointLook,
): LandmarkPoint | null {
	const isHidden = look.shown == "hidden";

	if (isHidden) return null;

	const isFaint = isLandmarkDrawn(point) == false;

	if (isFaint) return null;

	return point;
}

function isLandmarkDrawn(point: LandmarkPoint | null): point is LandmarkPoint {
	const isMissing = point == null;

	if (isMissing) return false;

	const minimumDrawnVisibility = 0.5;
	const isTooFaint = point.visibility < minimumDrawnVisibility;

	if (isTooFaint) return false;

	return true;
}
