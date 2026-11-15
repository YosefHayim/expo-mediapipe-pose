export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface JointArc {
	startRadians: number;
	sweepRadians: number;
	degrees: number;
}

export interface DrawInProgress {
	bones: number;
	joints: number;
	arc: number;
}

export interface ReadoutPlacement {
	labelLeft: number;
	labelTop: number;
	leaderEnd: Point;
}

const LANDMARK_VALUES = 3;
const MINIMUM_VISIBILITY = 0.5;
const BONES_DRAW_MILLISECONDS = 1200;
const JOINTS_POP_MILLISECONDS = 300;
const ARC_SWEEP_MILLISECONDS = 600;
const LEADER_RUN = 56;
const LEADER_RISE = 44;
const LABEL_MARGIN = 8;

const clampUnit = (number: number) => Math.min(1, Math.max(0, number));

export const pickFrameIndex = (
	currentTimeSeconds: number,
	framesPerSecond: number,
	frameCount: number,
) => Math.floor(currentTimeSeconds * framesPerSecond) % frameCount;

/** Reads one landmark of a recorded frame, or null when it is missing or hard to see. */
export const readLandmark = (
	frame: number[],
	landmarkIndex: number,
): Point | null => {
	const start = landmarkIndex * LANDMARK_VALUES;
	const x = frame[start];
	const y = frame[start + 1];
	const visibility = frame[start + 2];
	const isLandmarkMissing = x == null || y == null || visibility == null;
	if (isLandmarkMissing) return null;

	const isHardToSee = visibility < MINIMUM_VISIBILITY;
	if (isHardToSee) return null;

	return { x, y };
};

/** Maps a normalized landmark to canvas pixels the way object-fit: cover places the video. */
export const mapLandmarkToCanvas = (
	landmark: Point,
	videoSize: Size,
	canvasSize: Size,
): Point => {
	const scale = Math.max(
		canvasSize.width / videoSize.width,
		canvasSize.height / videoSize.height,
	);
	const offsetX = (canvasSize.width - videoSize.width * scale) / 2;
	const offsetY = (canvasSize.height - videoSize.height * scale) / 2;

	return {
		x: landmark.x * videoSize.width * scale + offsetX,
		y: landmark.y * videoSize.height * scale + offsetY,
	};
};

/** The angle at `joint` between the two limbs, and the arc that sweeps it. */
export const measureJointArc = (
	first: Point,
	joint: Point,
	last: Point,
): JointArc => {
	const startRadians = Math.atan2(first.y - joint.y, first.x - joint.x);
	const endRadians = Math.atan2(last.y - joint.y, last.x - joint.x);
	const fullTurn = Math.PI * 2;
	const rawSweep = (endRadians - startRadians) % fullTurn;
	const isSweepTooLongClockwise = rawSweep > Math.PI;
	const isSweepTooLongBackwards = rawSweep < -Math.PI;
	const wrappedSweep = isSweepTooLongClockwise
		? rawSweep - fullTurn
		: isSweepTooLongBackwards
			? rawSweep + fullTurn
			: rawSweep;

	return {
		startRadians,
		sweepRadians: wrappedSweep,
		degrees: Math.round((Math.abs(wrappedSweep) * 180) / Math.PI),
	};
};

/** Bones draw first, joints pop after them, then the angle arc sweeps. */
export const pickDrawInProgress = (
	elapsedMilliseconds: number,
): DrawInProgress => {
	const jointsStart = BONES_DRAW_MILLISECONDS;
	const arcStart = jointsStart + JOINTS_POP_MILLISECONDS;

	return {
		bones: clampUnit(elapsedMilliseconds / BONES_DRAW_MILLISECONDS),
		joints: clampUnit(
			(elapsedMilliseconds - jointsStart) / JOINTS_POP_MILLISECONDS,
		),
		arc: clampUnit((elapsedMilliseconds - arcStart) / ARC_SWEEP_MILLISECONDS),
	};
};

export const isPointInsideFrame = (point: Point, frameSize: Size) => {
	const isInsideAcross = point.x >= 0 && point.x <= frameSize.width;
	const isInsideDown = point.y >= 0 && point.y <= frameSize.height;
	return isInsideAcross && isInsideDown;
};

/** Puts the label beside the joint, pushed away from the middle, and keeps it inside the frame. */
export const placeReadoutLabel = (
	joint: Point,
	frameSize: Size,
	labelSize: Size,
): ReadoutPlacement => {
	const isJointRightOfMiddle = joint.x > frameSize.width / 2;
	const wantedLeft = isJointRightOfMiddle
		? joint.x + LEADER_RUN
		: joint.x - LEADER_RUN - labelSize.width;
	const wantedTop = joint.y - LEADER_RISE - labelSize.height / 2;
	const farthestLeft = frameSize.width - labelSize.width - LABEL_MARGIN;
	const farthestTop = frameSize.height - labelSize.height - LABEL_MARGIN;
	const labelLeft = Math.min(farthestLeft, Math.max(LABEL_MARGIN, wantedLeft));
	const labelTop = Math.min(farthestTop, Math.max(LABEL_MARGIN, wantedTop));
	const isLabelRightOfJoint = labelLeft + labelSize.width / 2 > joint.x;
	const leaderEndX = isLabelRightOfJoint
		? labelLeft
		: labelLeft + labelSize.width;

	return {
		labelLeft,
		labelTop,
		leaderEnd: { x: leaderEndX, y: labelTop + labelSize.height / 2 },
	};
};
