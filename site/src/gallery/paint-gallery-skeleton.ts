import {
	mapLandmarkToCanvas,
	type Point,
	readLandmark,
	type Size,
} from "@/landing/hero/hero-skeleton-logic";
import { BONES, JOINT_LANDMARKS } from "@/landing/hero/paint-hero-skeleton";
import type { MaskStrokeWidths, Region } from "./gallery-preview-logic";

export interface SkeletonLook {
	boneColor: string;
	jointColor: string;
	lineWidth: number;
	jointRadius: number;
}

const TORSO_BONES = new Set(["11:12", "11:23", "12:24", "23:24"]);
const NOSE = 0;
const MASK_OPACITY = 0.3;

/** Reads every drawn landmark of a recorded frame in canvas pixels inside the region. */
export const readRegionPoints = (
	frame: number[],
	videoSize: Size,
	region: Region,
) => {
	const points = new Map<number, Point>();
	const landmarkIndexes = new Set([...BONES.flat(), ...JOINT_LANDMARKS]);
	for (const landmarkIndex of landmarkIndexes) {
		const landmark = readLandmark(frame, landmarkIndex);
		if (landmark == null) continue;

		const mapped = mapLandmarkToCanvas(landmark, videoSize, region);
		points.set(landmarkIndex, {
			x: mapped.x + region.left,
			y: mapped.y + region.top,
		});
	}
	return points;
};

export const paintSkeleton = (
	context: CanvasRenderingContext2D,
	points: Map<number, Point>,
	look: SkeletonLook,
) => {
	context.strokeStyle = look.boneColor;
	context.lineWidth = look.lineWidth;
	context.lineCap = "round";
	for (const [fromIndex, toIndex] of BONES) {
		const from = points.get(fromIndex);
		const to = points.get(toIndex);
		const isBoneVisible = from != null && to != null;
		if (!isBoneVisible) continue;

		context.beginPath();
		context.moveTo(from.x, from.y);
		context.lineTo(to.x, to.y);
		context.stroke();
	}

	context.fillStyle = look.jointColor;
	for (const landmarkIndex of JOINT_LANDMARKS) {
		const point = points.get(landmarkIndex);
		if (point == null) continue;

		context.beginPath();
		context.arc(point.x, point.y, look.jointRadius, 0, Math.PI * 2);
		context.fill();
	}
};

const strokeBones = (
	context: CanvasRenderingContext2D,
	points: Map<number, Point>,
	isTorso: boolean,
) => {
	context.beginPath();
	for (const [fromIndex, toIndex] of BONES) {
		const isTorsoBone = TORSO_BONES.has(`${fromIndex}:${toIndex}`);
		const from = points.get(fromIndex);
		const to = points.get(toIndex);
		const isBoneSkipped = isTorsoBone !== isTorso || from == null || to == null;
		if (isBoneSkipped) continue;

		context.moveTo(from.x, from.y);
		context.lineTo(to.x, to.y);
	}
	context.stroke();
};

/** A soft body shape from thick rounded strokes along the bones; one path per width avoids darker overlaps. */
export const paintBodyMask = (
	context: CanvasRenderingContext2D,
	points: Map<number, Point>,
	color: string,
	widths: MaskStrokeWidths,
) => {
	context.save();
	context.globalAlpha = MASK_OPACITY;
	context.strokeStyle = color;
	context.fillStyle = color;
	context.lineCap = "round";
	context.lineJoin = "round";

	context.lineWidth = widths.torso;
	strokeBones(context, points, true);
	context.lineWidth = widths.limb;
	strokeBones(context, points, false);

	const nose = points.get(NOSE);
	if (nose != null) {
		context.beginPath();
		context.arc(nose.x, nose.y, widths.torso * 0.55, 0, Math.PI * 2);
		context.fill();
	}
	context.restore();
};
