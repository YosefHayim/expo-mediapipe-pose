import type { Landmark } from "../contracts";
import { hasLandmarkConfidence } from "./confidence";
import { LANDMARK_NAMES, type LandmarkName } from "./names";

export interface GeometryOptions {
	minVisibility?: number;
}
export interface ImageGeometryInput {
	landmarks: readonly Landmark[];
	imageSize: { width: number; height: number };
}
export interface WorldGeometryInput {
	worldLandmarks: readonly Landmark[];
}
export type MeasurementUnit = "degrees" | "pixels" | "meters";
export type UnavailableMeasurement = {
	status: "unavailable";
	reason:
		| "missing-landmark"
		| "uncertain-landmark"
		| "invalid-coordinates"
		| "degenerate-angle";
};
export type PoseMeasurement<Unit extends MeasurementUnit = MeasurementUnit> =
	| { status: "available"; value: number; unit: Unit }
	| UnavailableMeasurement;
type Point = readonly [number, number, number];
type PointsReport =
	| { status: "available"; points: Point[] }
	| UnavailableMeasurement;

const validateConfidence = (settings: GeometryOptions) => {
	const minimum = settings.minVisibility ?? 0.6;

	const inRange = minimum >= 0 && minimum <= 1;

	const isMinimumInvalid = !Number.isFinite(minimum) || !inRange;
	if (isMinimumInvalid)
		throw new RangeError("minVisibility must be between 0 and 1");

	return minimum;
};
interface ReadPointsDetails {
	landmarks: readonly Landmark[];
	names: readonly LandmarkName[];
	project: (joint: Landmark) => Point;
	geometry: GeometryOptions;
}

const readPoints = ({
	landmarks,
	names,
	project,
	geometry: settings,
}: ReadPointsDetails): PointsReport => {
	const minimum = validateConfidence(settings);
	const points: Point[] = [];
	for (const name of names) {
		const joint = landmarks[LANDMARK_NAMES.indexOf(name)];

		const isJointMissing = joint == null;
		if (isJointMissing)
			return { status: "unavailable", reason: "missing-landmark" };

		const isLowConfidence = !hasLandmarkConfidence(joint, minimum);
		if (isLowConfidence)
			return { status: "unavailable", reason: "uncertain-landmark" };

		const point = project(joint);

		const hasNonFinitePoint = !point.every(Number.isFinite);
		if (hasNonFinitePoint)
			return { status: "unavailable", reason: "invalid-coordinates" };

		points.push(point);
	}
	return { status: "available", points };
};
const readImagePoints = (
	details: ImageGeometryInput,
	names: readonly LandmarkName[],
	settings: GeometryOptions,
) => {
	const { width, height } = details.imageSize;

	const dimensionsValid = [width, height].every(
		(amount) => Number.isFinite(amount) && amount > 0,
	);

	const areDimensionsInvalid = !dimensionsValid;
	if (areDimensionsInvalid)
		throw new RangeError("Image width and height must be finite and positive");

	return readPoints({
		landmarks: details.landmarks,
		names,
		project: (joint) => [joint.x * width, joint.y * height, 0],
		geometry: settings,
	});
};
const readWorldPoints = (
	details: WorldGeometryInput,
	names: readonly LandmarkName[],
	settings: GeometryOptions,
) =>
	readPoints({
		landmarks: details.worldLandmarks,
		names,
		project: (joint) => [joint.x, joint.y, joint.z],
		geometry: settings,
	});
const subtractPoints = (left: Point, right: Point): Point => [
	left[0] - right[0],
	left[1] - right[1],
	left[2] - right[2],
];

const measureAngle = (report: PointsReport): PoseMeasurement<"degrees"> => {
	const isStatusUnavailable = report.status === "unavailable";
	if (isStatusUnavailable) return report;

	const [start, vertex, end] = report.points;

	const isAnyLandmarkMissing = start == null || vertex == null || end == null;
	if (isAnyLandmarkMissing) throw new Error("An angle requires three points");

	const first = subtractPoints(start, vertex);
	const second = subtractPoints(end, vertex);
	const firstLength = Math.hypot(...first);

	const secondLength = Math.hypot(...second);

	const hasNonFiniteLength = ![firstLength, secondLength].every(
		Number.isFinite,
	);
	if (hasNonFiniteLength)
		return { status: "unavailable", reason: "invalid-coordinates" };

	const hasZeroLength = firstLength === 0 || secondLength === 0;
	if (hasZeroLength)
		return { status: "unavailable", reason: "degenerate-angle" };

	const firstDirectionHorizontal = first[0] / firstLength;
	const firstDirectionY = first[1] / firstLength;
	const firstDirectionZ = first[2] / firstLength;
	const secondDirectionHorizontal = second[0] / secondLength;
	const secondDirectionY = second[1] / secondLength;
	const secondDirectionZ = second[2] / secondLength;
	const crossLength = Math.hypot(
		firstDirectionY * secondDirectionZ - firstDirectionZ * secondDirectionY,
		firstDirectionZ * secondDirectionHorizontal -
			firstDirectionHorizontal * secondDirectionZ,
		firstDirectionHorizontal * secondDirectionY -
			firstDirectionY * secondDirectionHorizontal,
	);
	const dot =
		firstDirectionHorizontal * secondDirectionHorizontal +
		firstDirectionY * secondDirectionY +
		firstDirectionZ * secondDirectionZ;
	return {
		status: "available",
		value: (Math.atan2(crossLength, dot) * 180) / Math.PI,
		unit: "degrees",
	};
};
const measureDistance = <Unit extends "pixels" | "meters">(
	report: PointsReport,
	unit: Unit,
): PoseMeasurement<Unit> => {
	const isStatusUnavailable = report.status === "unavailable";
	if (isStatusUnavailable) return report;

	const [start, end] = report.points;

	const isStartOrEndMissing = start == null || end == null;
	if (isStartOrEndMissing) throw new Error("A distance requires two points");

	const distance = Math.hypot(...subtractPoints(start, end));

	const isNonFinite = !Number.isFinite(distance);
	if (isNonFinite)
		return { status: "unavailable", reason: "invalid-coordinates" };

	return { status: "available", value: distance, unit };
};

export const getImageJointAngle = (
	details: ImageGeometryInput,
	start: LandmarkName,
	vertex: LandmarkName,
	end: LandmarkName,
	settings: GeometryOptions = {},
): PoseMeasurement<"degrees"> =>
	measureAngle(readImagePoints(details, [start, vertex, end], settings));
export const getWorldJointAngle = (
	details: WorldGeometryInput,
	start: LandmarkName,
	vertex: LandmarkName,
	end: LandmarkName,
	settings: GeometryOptions = {},
): PoseMeasurement<"degrees"> =>
	measureAngle(readWorldPoints(details, [start, vertex, end], settings));
export const getImageDistance = (
	details: ImageGeometryInput,
	start: LandmarkName,
	end: LandmarkName,
	settings: GeometryOptions = {},
): PoseMeasurement<"pixels"> =>
	measureDistance(readImagePoints(details, [start, end], settings), "pixels");
export const getWorldDistance = (
	details: WorldGeometryInput,
	start: LandmarkName,
	end: LandmarkName,
	settings: GeometryOptions = {},
): PoseMeasurement<"meters"> =>
	measureDistance(readWorldPoints(details, [start, end], settings), "meters");
