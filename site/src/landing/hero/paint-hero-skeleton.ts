import {
	type DrawInProgress,
	isPointInsideFrame,
	mapLandmarkToCanvas,
	measureJointArc,
	type Point,
	placeReadoutLabel,
	type ReadoutPlacement,
	readLandmark,
	type Size,
} from "./hero-skeleton-logic";

export interface SkeletonColors {
	bone: string;
	joint: string;
}

export interface ReadoutPose {
	degrees: number;
	placement: ReadoutPlacement;
}

interface SkeletonScene {
	frame: number[];
	videoSize: Size;
	canvasSize: Size;
	progress: DrawInProgress;
	colors: SkeletonColors;
}

export const READOUT_LABEL_SIZE: Size = { width: 152, height: 26 };

export const BONES: readonly (readonly [number, number])[] = [
	[11, 12],
	[11, 13],
	[13, 15],
	[12, 14],
	[14, 16],
	[11, 23],
	[12, 24],
	[23, 24],
	[23, 25],
	[25, 27],
	[24, 26],
	[26, 28],
	[27, 29],
	[29, 31],
	[27, 31],
	[28, 30],
	[30, 32],
	[28, 32],
];
export const JOINT_LANDMARKS = [
	0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32,
];
const LEFT_SHOULDER = 11;
const LEFT_ELBOW = 13;
const LEFT_WRIST = 15;
const BONE_WIDTH = 2;
const JOINT_RADIUS = 4.5;
const ARC_RADIUS = 22;
const LEADER_WIDTH = 1;
const MINIMUM_READOUT_WIDTH = 200;

const paintBones = (
	context: CanvasRenderingContext2D,
	points: Map<number, Point>,
	progress: number,
	color: string,
) => {
	context.strokeStyle = color;
	context.lineWidth = BONE_WIDTH;
	context.lineCap = "round";
	for (const [fromIndex, toIndex] of BONES) {
		const from = points.get(fromIndex);
		const to = points.get(toIndex);
		const isBoneVisible = from != null && to != null;
		if (!isBoneVisible) continue;

		context.beginPath();
		context.moveTo(from.x, from.y);
		context.lineTo(
			from.x + (to.x - from.x) * progress,
			from.y + (to.y - from.y) * progress,
		);
		context.stroke();
	}
};

const paintJoints = (
	context: CanvasRenderingContext2D,
	points: Map<number, Point>,
	progress: number,
	color: string,
) => {
	context.fillStyle = color;
	for (const landmarkIndex of JOINT_LANDMARKS) {
		const point = points.get(landmarkIndex);
		if (point == null) continue;

		context.beginPath();
		context.arc(point.x, point.y, JOINT_RADIUS * progress, 0, Math.PI * 2);
		context.fill();
	}
};

const paintReadout = (
	context: CanvasRenderingContext2D,
	points: Map<number, Point>,
	scene: SkeletonScene,
): ReadoutPose | null => {
	const shoulder = points.get(LEFT_SHOULDER);
	const elbow = points.get(LEFT_ELBOW);
	const wrist = points.get(LEFT_WRIST);
	const isLimbVisible = shoulder != null && elbow != null && wrist != null;
	if (!isLimbVisible) return null;

	const isFrameWideEnough = scene.canvasSize.width >= MINIMUM_READOUT_WIDTH;
	const isElbowInFrame = isPointInsideFrame(elbow, scene.canvasSize);
	const isReadoutShown =
		isFrameWideEnough && isElbowInFrame && scene.progress.joints > 0;
	if (!isReadoutShown) return null;

	const arc = measureJointArc(shoulder, elbow, wrist);
	const placement = placeReadoutLabel(
		elbow,
		scene.canvasSize,
		READOUT_LABEL_SIZE,
	);

	context.strokeStyle = scene.colors.joint;
	context.lineWidth = LEADER_WIDTH;
	context.beginPath();
	context.moveTo(elbow.x, elbow.y);
	context.lineTo(placement.leaderEnd.x, placement.leaderEnd.y);
	context.stroke();

	context.lineWidth = BONE_WIDTH;
	context.beginPath();
	context.arc(
		elbow.x,
		elbow.y,
		ARC_RADIUS,
		arc.startRadians,
		arc.startRadians + arc.sweepRadians * scene.progress.arc,
		arc.sweepRadians < 0,
	);
	context.stroke();

	context.fillStyle = scene.colors.joint;
	context.beginPath();
	context.arc(elbow.x, elbow.y, JOINT_RADIUS, 0, Math.PI * 2);
	context.fill();

	return { degrees: arc.degrees, placement };
};

/** Paints one recorded frame on the canvas and returns what the label beside the joint should show. */
export const paintHeroSkeleton = (
	context: CanvasRenderingContext2D,
	scene: SkeletonScene,
): ReadoutPose | null => {
	context.clearRect(0, 0, scene.canvasSize.width, scene.canvasSize.height);

	const points = new Map<number, Point>();
	const landmarkIndexes = new Set([...BONES.flat(), ...JOINT_LANDMARKS]);
	for (const landmarkIndex of landmarkIndexes) {
		const landmark = readLandmark(scene.frame, landmarkIndex);
		if (landmark == null) continue;

		points.set(
			landmarkIndex,
			mapLandmarkToCanvas(landmark, scene.videoSize, scene.canvasSize),
		);
	}

	paintBones(context, points, scene.progress.bones, scene.colors.bone);
	paintJoints(context, points, scene.progress.joints, scene.colors.bone);

	return paintReadout(context, points, scene);
};
