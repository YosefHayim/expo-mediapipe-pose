import {
	type Point,
	readLandmark,
	type Size,
} from "@/landing/hero/hero-skeleton-logic";

export type RuleStatus = "pass" | "fail" | "unknown";
type SkeletonColorName = "signal" | "joint" | "text";
export type CameraFacing = "front" | "back";

interface CyclingStyle {
	colorName: SkeletonColorName;
	lineWidth: number;
	jointRadius: number;
}

export interface MaskStrokeWidths {
	limb: number;
	torso: number;
}

export interface Region {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface CornerMark {
	corner: Point;
	horizontalEnd: Point;
	verticalEnd: Point;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const STYLE_STEP_MILLISECONDS = 1800;
const CAMERA_STEP_MILLISECONDS = 2400;
const LIMB_WIDTH_SHARE = 0.07;
const TORSO_WIDTH_SHARE = 0.16;
const CORNER_INSET = 10;
const CORNER_ARM = 14;

const CYCLING_STYLES: readonly CyclingStyle[] = [
	{ colorName: "signal", lineWidth: 2, jointRadius: 3.5 },
	{ colorName: "joint", lineWidth: 4, jointRadius: 5.5 },
	{ colorName: "text", lineWidth: 6, jointRadius: 7.5 },
];

const RULE_STATUS_TEXTS: Record<RuleStatus, string> = {
	pass: "MET",
	fail: "NOT MET",
	unknown: "UNKNOWN",
};

/** The first recorded frame that holds a pose, so a still picture is never empty. */
export const pickStillFrameIndex = (frames: readonly number[][]) => {
	const poseFrameIndex = frames.findIndex((frame) => frame.length > 0);
	const isPoseFound = poseFrameIndex >= 0;
	return isPoseFound ? poseFrameIndex : 0;
};

/** Both wrists above both shoulders; unknown while any of the four is missing or hard to see. */
export const judgeWristsAboveShoulders = (frame: number[]): RuleStatus => {
	const leftShoulder = readLandmark(frame, LEFT_SHOULDER);
	const rightShoulder = readLandmark(frame, RIGHT_SHOULDER);
	const leftWrist = readLandmark(frame, LEFT_WRIST);
	const rightWrist = readLandmark(frame, RIGHT_WRIST);
	const isAnyLandmarkUnknown =
		leftShoulder == null ||
		rightShoulder == null ||
		leftWrist == null ||
		rightWrist == null;
	if (isAnyLandmarkUnknown) return "unknown";

	const isLeftWristAbove = leftWrist.y < leftShoulder.y;
	const isRightWristAbove = rightWrist.y < rightShoulder.y;
	const areBothWristsAbove = isLeftWristAbove && isRightWristAbove;
	return areBothWristsAbove ? "pass" : "fail";
};

export const pickRuleStatusText = (status: RuleStatus) =>
	RULE_STATUS_TEXTS[status];

/** How far along a looping clip the playhead is, from 0 to 1. */
export const pickTimelineProgress = (
	elapsedMilliseconds: number,
	durationMilliseconds: number,
) => (elapsedMilliseconds % durationMilliseconds) / durationMilliseconds;

/** Steps through bone color, thickness and joint size together, one look at a time. */
export const pickCyclingStyle = (elapsedMilliseconds: number): CyclingStyle => {
	const stepIndex =
		Math.floor(elapsedMilliseconds / STYLE_STEP_MILLISECONDS) %
		CYCLING_STYLES.length;
	// The modulo keeps the index inside the list, so the lookup always finds a style.
	return CYCLING_STYLES[stepIndex] as CyclingStyle;
};

export const pickCameraFacing = (elapsedMilliseconds: number): CameraFacing => {
	const stepIndex = Math.floor(elapsedMilliseconds / CAMERA_STEP_MILLISECONDS);
	const isStepEven = stepIndex % 2 === 0;
	return isStepEven ? "front" : "back";
};

/** Soft body shape strokes: thin along limbs, thick across the torso. */
export const pickMaskStrokeWidths = (
	canvasHeight: number,
): MaskStrokeWidths => ({
	limb: canvasHeight * LIMB_WIDTH_SHARE,
	torso: canvasHeight * TORSO_WIDTH_SHARE,
});

/** The largest box with the video's shape that fits the slot, centered in it. */
export const pickContainedRegion = (slot: Region, videoSize: Size): Region => {
	const scale = Math.min(
		slot.width / videoSize.width,
		slot.height / videoSize.height,
	);
	const width = videoSize.width * scale;
	const height = videoSize.height * scale;

	return {
		left: slot.left + (slot.width - width) / 2,
		top: slot.top + (slot.height - height) / 2,
		width,
		height,
	};
};

/** Four viewfinder corners, each with the ends of its two short arms. */
export const pickViewfinderCornerMarks = (canvasSize: Size): CornerMark[] => {
	const nearLeft = CORNER_INSET;
	const nearTop = CORNER_INSET;
	const farRight = canvasSize.width - CORNER_INSET;
	const farBottom = canvasSize.height - CORNER_INSET;

	return [
		{
			corner: { x: nearLeft, y: nearTop },
			horizontalEnd: { x: nearLeft + CORNER_ARM, y: nearTop },
			verticalEnd: { x: nearLeft, y: nearTop + CORNER_ARM },
		},
		{
			corner: { x: farRight, y: nearTop },
			horizontalEnd: { x: farRight - CORNER_ARM, y: nearTop },
			verticalEnd: { x: farRight, y: nearTop + CORNER_ARM },
		},
		{
			corner: { x: nearLeft, y: farBottom },
			horizontalEnd: { x: nearLeft + CORNER_ARM, y: farBottom },
			verticalEnd: { x: nearLeft, y: farBottom - CORNER_ARM },
		},
		{
			corner: { x: farRight, y: farBottom },
			horizontalEnd: { x: farRight - CORNER_ARM, y: farBottom },
			verticalEnd: { x: farRight, y: farBottom - CORNER_ARM },
		},
	];
};
