import type { HeroLandmarks } from "@/landing/hero/hero-landmarks-schema";
import {
	isPointInsideFrame,
	pickFrameIndex,
	type Size,
} from "@/landing/hero/hero-skeleton-logic";
import {
	judgeWristsAboveShoulders,
	pickCameraFacing,
	pickContainedRegion,
	pickCyclingStyle,
	pickMaskStrokeWidths,
	pickStillFrameIndex,
	pickTimelineProgress,
	type Region,
} from "./gallery-preview-logic";
import {
	paintCameraIndicator,
	paintCaption,
	paintDividerLine,
	paintJointReadout,
	paintProgressBar,
	paintRuleStatus,
	paintTimeline,
	paintViewfinder,
	pickStatusColor,
} from "./paint-gallery-overlays";
import {
	paintBodyMask,
	paintSkeleton,
	readRegionPoints,
	type SkeletonLook,
} from "./paint-gallery-skeleton";
import type { PreviewColors } from "./preview-colors";

export type PreviewKind =
	| "camera"
	| "style"
	| "mask"
	| "angles"
	| "people"
	| "photo-video"
	| "rules"
	| "replay"
	| "cameras";

interface PreviewScene {
	landmarks: HeroLandmarks;
	colors: PreviewColors;
	canvasSize: Size;
	elapsedMilliseconds: number;
}

type PreviewPainter = (
	context: CanvasRenderingContext2D,
	scene: PreviewScene,
) => void;

const LEFT_SHOULDER = 11;
const LEFT_ELBOW = 13;
const LEFT_WRIST = 15;
const SECOND_PERSON_DELAY_MILLISECONDS = 1500;
const PEOPLE_OFFSET_SHARE = 0.18;
const SPLIT_GAP = 4;

const readFrameAt = (landmarks: HeroLandmarks, elapsedMilliseconds: number) => {
	const frameIndex = pickFrameIndex(
		elapsedMilliseconds / 1000,
		landmarks.fps,
		landmarks.frames.length,
	);
	return landmarks.frames[frameIndex] ?? [];
};

const readVideoSize = (landmarks: HeroLandmarks): Size => ({
	width: landmarks.width,
	height: landmarks.height,
});

const readWholeCanvas = (canvasSize: Size): Region => ({
	left: 0,
	top: 0,
	...canvasSize,
});

const readDefaultLook = (colors: PreviewColors): SkeletonLook => ({
	boneColor: colors.signal,
	jointColor: colors.joint,
	lineWidth: 2,
	jointRadius: 4.5,
});

const paintWholeSkeleton = (
	context: CanvasRenderingContext2D,
	scene: PreviewScene,
	look: SkeletonLook,
) => {
	const frame = readFrameAt(scene.landmarks, scene.elapsedMilliseconds);
	const points = readRegionPoints(
		frame,
		readVideoSize(scene.landmarks),
		readWholeCanvas(scene.canvasSize),
	);
	paintSkeleton(context, points, look);
};

const paintCameraPreview: PreviewPainter = (context, scene) => {
	paintWholeSkeleton(context, scene, readDefaultLook(scene.colors));
	paintViewfinder(context, scene.canvasSize, scene.colors.signal);
};

const paintStylePreview: PreviewPainter = (context, scene) => {
	const style = pickCyclingStyle(scene.elapsedMilliseconds);
	const isBoneColorJoint = style.colorName === "joint";
	const boneColor = scene.colors[style.colorName];
	const jointColor = isBoneColorJoint
		? scene.colors.signal
		: scene.colors.joint;
	paintWholeSkeleton(context, scene, {
		boneColor,
		jointColor,
		lineWidth: style.lineWidth,
		jointRadius: style.jointRadius,
	});
	paintCaption(
		context,
		`lineWidth: ${style.lineWidth}  jointRadius: ${style.jointRadius}`,
		{ x: 8, y: 8 },
		scene.colors,
	);
};

const paintMaskPreview: PreviewPainter = (context, scene) => {
	const frame = readFrameAt(scene.landmarks, scene.elapsedMilliseconds);
	const points = readRegionPoints(
		frame,
		readVideoSize(scene.landmarks),
		readWholeCanvas(scene.canvasSize),
	);
	const widths = pickMaskStrokeWidths(scene.canvasSize.height);
	paintBodyMask(context, points, scene.colors.signal, widths);
	paintSkeleton(context, points, readDefaultLook(scene.colors));
};

const paintAnglesPreview: PreviewPainter = (context, scene) => {
	const frame = readFrameAt(scene.landmarks, scene.elapsedMilliseconds);
	const points = readRegionPoints(
		frame,
		readVideoSize(scene.landmarks),
		readWholeCanvas(scene.canvasSize),
	);
	paintSkeleton(context, points, readDefaultLook(scene.colors));

	const first = points.get(LEFT_SHOULDER);
	const joint = points.get(LEFT_ELBOW);
	const last = points.get(LEFT_WRIST);
	const isLimbVisible = first != null && joint != null && last != null;
	if (!isLimbVisible) return;

	const isElbowInFrame = isPointInsideFrame(joint, scene.canvasSize);
	if (!isElbowInFrame) return;

	paintJointReadout(
		context,
		{ first, joint, last },
		"LEFT ELBOW",
		scene.canvasSize,
		scene.colors,
	);
};

const paintPeoplePreview: PreviewPainter = (context, scene) => {
	const videoSize = readVideoSize(scene.landmarks);
	const whole = readWholeCanvas(scene.canvasSize);
	const offset = scene.canvasSize.width * PEOPLE_OFFSET_SHARE;
	const firstFrame = readFrameAt(scene.landmarks, scene.elapsedMilliseconds);
	const secondFrame = readFrameAt(
		scene.landmarks,
		scene.elapsedMilliseconds + SECOND_PERSON_DELAY_MILLISECONDS,
	);
	const defaultLook = readDefaultLook(scene.colors);

	const firstPoints = readRegionPoints(firstFrame, videoSize, {
		...whole,
		left: -offset,
	});
	const secondPoints = readRegionPoints(secondFrame, videoSize, {
		...whole,
		left: offset,
	});
	paintSkeleton(context, firstPoints, defaultLook);
	paintSkeleton(context, secondPoints, {
		...defaultLook,
		boneColor: scene.colors.text,
	});
};

const paintPhotoVideoPreview: PreviewPainter = (context, scene) => {
	const videoSize = readVideoSize(scene.landmarks);
	const halfWidth = scene.canvasSize.width / 2 - SPLIT_GAP;
	const stillRegion = pickContainedRegion(
		{ left: 0, top: 0, width: halfWidth, height: scene.canvasSize.height },
		videoSize,
	);
	const movingRegion = pickContainedRegion(
		{
			left: scene.canvasSize.width / 2 + SPLIT_GAP,
			top: 0,
			width: halfWidth,
			height: scene.canvasSize.height,
		},
		videoSize,
	);
	const stillFrame =
		scene.landmarks.frames[pickStillFrameIndex(scene.landmarks.frames)] ?? [];
	const movingFrame = readFrameAt(scene.landmarks, scene.elapsedMilliseconds);
	const look = readDefaultLook(scene.colors);

	paintSkeleton(
		context,
		readRegionPoints(stillFrame, videoSize, stillRegion),
		look,
	);
	paintSkeleton(
		context,
		readRegionPoints(movingFrame, videoSize, movingRegion),
		look,
	);
	paintDividerLine(context, scene.canvasSize, scene.colors);
	paintProgressBar(
		context,
		movingRegion,
		pickTimelineProgress(scene.elapsedMilliseconds, scene.landmarks.durationMs),
		scene.colors,
	);
	paintCaption(context, "PHOTO", { x: 8, y: 8 }, scene.colors);
	paintCaption(
		context,
		"VIDEO",
		{ x: scene.canvasSize.width / 2 + SPLIT_GAP + 4, y: 8 },
		scene.colors,
	);
};

const paintRulesPreview: PreviewPainter = (context, scene) => {
	const frame = readFrameAt(scene.landmarks, scene.elapsedMilliseconds);
	const status = judgeWristsAboveShoulders(frame);
	const statusColor = pickStatusColor(status, scene.colors);
	paintWholeSkeleton(context, scene, {
		...readDefaultLook(scene.colors),
		boneColor: statusColor,
		jointColor: statusColor,
	});
	paintRuleStatus(context, status, scene.canvasSize, scene.colors);
};

const paintReplayPreview: PreviewPainter = (context, scene) => {
	paintWholeSkeleton(context, scene, readDefaultLook(scene.colors));
	paintTimeline(
		context,
		scene.canvasSize,
		pickTimelineProgress(scene.elapsedMilliseconds, scene.landmarks.durationMs),
		scene.colors,
	);
};

const paintCamerasPreview: PreviewPainter = (context, scene) => {
	paintWholeSkeleton(context, scene, readDefaultLook(scene.colors));
	paintCameraIndicator(
		context,
		pickCameraFacing(scene.elapsedMilliseconds),
		scene.canvasSize,
		scene.colors,
	);
};

const PREVIEW_PAINTERS: Record<PreviewKind, PreviewPainter> = {
	camera: paintCameraPreview,
	style: paintStylePreview,
	mask: paintMaskPreview,
	angles: paintAnglesPreview,
	people: paintPeoplePreview,
	"photo-video": paintPhotoVideoPreview,
	rules: paintRulesPreview,
	replay: paintReplayPreview,
	cameras: paintCamerasPreview,
};

/** Clears the canvas and paints what the feature looks like at this moment of the recording. */
export const paintGalleryPreview = (
	context: CanvasRenderingContext2D,
	kind: PreviewKind,
	scene: PreviewScene,
) => {
	context.clearRect(0, 0, scene.canvasSize.width, scene.canvasSize.height);
	PREVIEW_PAINTERS[kind](context, scene);
};
