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
	/** A provided list selects body parts; omission shows every part. */
	bodyParts?: readonly BodyPart[];
	/** Further restricts the joints shown, without filtering detection results. */
	landmarks?: readonly LandmarkName[];
	minVisibility?: number;
	joints?: Partial<Record<LandmarkName, JointStyle>>;
	connections?: Partial<Record<ConnectionName, ConnectionStyle>>;
}

export interface Dimensions {
	width: number;
	height: number;
}

/** Maps upright, already mirrored inference coordinates into an aspect-fill preview. */
export const projectLandmark = (
	landmark: Landmark,
	image: Dimensions,
	view: Dimensions,
) => {
	const isAnyDimensionInvalid = ![
		image.width,
		image.height,
		view.width,
		view.height,
	].every((value) => Number.isFinite(value) && value > 0);
	if (isAnyDimensionInvalid) {
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
	options: SkeletonOptions = {},
) => {
	const poseIndex = options.poseIndex;
	const isPoseIndexMissing = poseIndex == null;
	const selected = isPoseIndexMissing
		? detection
		: selectPose(detection, poseIndex);
	const style = { ...defaultSkeletonStyle, ...options };

	const visibilityInRange =
		style.minVisibility >= 0 && style.minVisibility <= 1;

	const isMinVisibilityInvalid =
		!Number.isFinite(style.minVisibility) || !visibilityInRange;
	if (isMinVisibilityInvalid) {
		throw new RangeError("minVisibility must be between 0 and 1");
	}

	let selectedNames: readonly LandmarkName[] = LANDMARK_NAMES;

	if (options.bodyParts)
		selectedNames = options.bodyParts.flatMap((part) => [...BODY_PARTS[part]]);

	const selectedNamesSet = new Set(selectedNames);

	const points = LANDMARK_NAMES.flatMap((name, index) => {
		const joint = selected.landmarks[index];

		const isJointMissingOrNotNameInSelectedNamesSet =
			!joint || !selectedNamesSet.has(name);
		if (isJointMissingOrNotNameInSelectedNamesSet) return [];

		const excludedBySelection =
			options.landmarks && !options.landmarks.includes(name);
		if (excludedBySelection) return [];

		const isJointVisibilityMissing = joint.visibility === undefined;
		if (isJointVisibilityMissing) return [];

		const isNotJointVisibilityFinite = !Number.isFinite(joint.visibility);
		if (isNotJointVisibilityFinite) return [];

		const isJointBelowMinVisibility = joint.visibility < style.minVisibility;
		if (isJointBelowMinVisibility) return [];

		const jointStyle = {
			color: style.color,
			radius: style.jointRadius,
			...options.joints?.[name],
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

		const isStartMissingOrEndMissing = !start || !end;
		if (isStartMissingOrEndMissing) return [];

		const name = `${from}:${to}` as ConnectionName;
		const connectionStyle = {
			color: style.color,
			width: style.lineWidth,
			...options.connections?.[name],
		};
		return [{ name, start, end, ...connectionStyle }];
	});
	return { points, lines };
};

export const createSkeleton = (
	frame: PoseFrame,
	view: Dimensions,
	options: SkeletonOptions = {},
) =>
	createDetectionSkeleton(
		{ ...frame, imageSize: frame.additionalData },
		view,
		options,
	);
