import type { Landmark, PoseFrame } from "../contracts";
import {
	BODY_PARTS,
	type BodyPart,
	type ConnectionName,
	LANDMARK_NAMES,
	type LandmarkName,
	POSE_CONNECTIONS,
} from "../landmarks/names";

import { type SelectablePose, selectPose } from "./selection";

export interface JointStyle {
	color?: string;
	radius?: number;
}

export interface ConnectionStyle {
	color?: string;
	width?: number;
}

export interface SkeletonOptions {
	poseIndex?: number;
	color?: string;
	jointRadius?: number;
	lineWidth?: number;
	bodyParts?: readonly BodyPart[];
	landmarks?: readonly LandmarkName[];
	minVisibility?: number;
	joints?: Partial<Record<LandmarkName, JointStyle>>;
	connections?: Partial<Record<ConnectionName, ConnectionStyle>>;
}

export interface Dimensions {
	width: number;
	height: number;
}

export const projectLandmark = (
	landmark: Landmark,
	image: Dimensions,
	view: Dimensions,
) => {
	const hasInvalidDimension = ![
		image.width,
		image.height,
		view.width,
		view.height,
	].every((amount) => Number.isFinite(amount) && amount > 0);
	if (hasInvalidDimension) {
		throw new RangeError(
			"Image and view dimensions must be finite and positive",
		);
	}

	const scale = Math.max(view.width / image.width, view.height / image.height);
	return {
		x:
			landmark.x * image.width * scale + (view.width - image.width * scale) / 2,
		y:
			landmark.y * image.height * scale +
			(view.height - image.height * scale) / 2,
	};
};

const defaultSkeletonStyle = {
	color: "#22c55e",
	jointRadius: 4,
	lineWidth: 3,
	minVisibility: 0.5,
};

export const createDetectionSkeleton = (
	detection: SelectablePose & { imageSize: Dimensions },
	view: Dimensions,
	settings: SkeletonOptions = {},
) => {
	const poseIndex = settings.poseIndex;
	const isPoseIndexMissing = poseIndex == null;
	const selected = isPoseIndexMissing
		? detection
		: selectPose(detection, poseIndex);
	const style = { ...defaultSkeletonStyle, ...settings };

	const visibilityInRange =
		style.minVisibility >= 0 && style.minVisibility <= 1;

	const isMinVisibilityInvalid =
		!Number.isFinite(style.minVisibility) || !visibilityInRange;
	if (isMinVisibilityInvalid) {
		throw new RangeError("minVisibility must be between 0 and 1");
	}

	let selectedNames: readonly LandmarkName[] = LANDMARK_NAMES;

	if (settings.bodyParts)
		selectedNames = settings.bodyParts.flatMap((part) => [...BODY_PARTS[part]]);

	const selectedNamesSet = new Set(selectedNames);

	const points = LANDMARK_NAMES.flatMap((name, index) => {
		const joint = selected.landmarks[index];

		const isJointNotSelected = !joint || !selectedNamesSet.has(name);
		if (isJointNotSelected) return [];

		const excludedBySelection =
			settings.landmarks && !settings.landmarks.includes(name);
		if (excludedBySelection) return [];

		const visibility = joint.visibility;
		const isVisibilityMissing = visibility == null;
		if (isVisibilityMissing) return [];

		const hasNonFiniteVisibility = !Number.isFinite(visibility);
		if (hasNonFiniteVisibility) return [];

		const isJointBelowMinVisibility = visibility < style.minVisibility;
		if (isJointBelowMinVisibility) return [];

		const jointStyle = {
			color: style.color,
			radius: style.jointRadius,
			...settings.joints?.[name],
		};
		return [
			{
				name,
				...projectLandmark(joint, detection.imageSize, view),
				...jointStyle,
			},
		];
	});

	const byName = new Map(points.map((point) => [point.name, point]));
	const lines = POSE_CONNECTIONS.flatMap(([from, to]) => {
		const start = byName.get(from);

		const end = byName.get(to);

		const isStartOrEndMissing = start == null || end == null;
		if (isStartOrEndMissing) return [];

		const name = `${from}:${to}` as ConnectionName;
		const connectionStyle = {
			color: style.color,
			width: style.lineWidth,
			...settings.connections?.[name],
		};
		return [{ name, start, end, ...connectionStyle }];
	});
	return { points, lines };
};

export const createSkeleton = (
	frame: PoseFrame,
	view: Dimensions,
	settings: SkeletonOptions = {},
) =>
	createDetectionSkeleton(
		{ ...frame, imageSize: frame.additionalData },
		view,
		settings,
	);
