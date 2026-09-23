import type { Landmark } from "../contracts";
import { LANDMARK_NAMES, type LandmarkName } from "./landmarks";

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
type PointsResult =
	| { status: "available"; points: Point[] }
	| UnavailableMeasurement;

const validateConfidence = (options: GeometryOptions) => {
	const minimum = options.minVisibility ?? 0.6;
	const inRange = minimum >= 0 && minimum <= 1;
	if (!Number.isFinite(minimum) || !inRange)
		throw new RangeError("minVisibility must be between 0 and 1");
	return minimum;
};
const hasConfidence = (joint: Landmark, minimum: number) => {
	if (joint.visibility === undefined) return false;
	if (!Number.isFinite(joint.visibility)) return false;
	if (joint.visibility < minimum || joint.visibility > 1) return false;
	if (joint.presence === undefined) return true;
	if (!Number.isFinite(joint.presence)) return false;
	return joint.presence >= minimum && joint.presence <= 1;
};
const readPoints = (
	landmarks: readonly Landmark[],
	names: readonly LandmarkName[],
	project: (joint: Landmark) => Point,
	options: GeometryOptions,
): PointsResult => {
	const minimum = validateConfidence(options);
	const points: Point[] = [];
	for (const name of names) {
		const joint = landmarks[LANDMARK_NAMES.indexOf(name)];
		if (!joint) return { status: "unavailable", reason: "missing-landmark" };
		if (!hasConfidence(joint, minimum))
			return { status: "unavailable", reason: "uncertain-landmark" };
		const point = project(joint);
		if (!point.every(Number.isFinite))
			return { status: "unavailable", reason: "invalid-coordinates" };
		points.push(point);
	}
	return { status: "available", points };
};
const imagePoints = (
	input: ImageGeometryInput,
	names: readonly LandmarkName[],
	options: GeometryOptions,
) => {
	const { width, height } = input.imageSize;
	const dimensionsValid = [width, height].every(
		(value) => Number.isFinite(value) && value > 0,
	);
	if (!dimensionsValid)
		throw new RangeError("Image width and height must be finite and positive");
	return readPoints(
		input.landmarks,
		names,
		(joint) => [joint.x * width, joint.y * height, 0],
		options,
	);
};
const worldPoints = (
	input: WorldGeometryInput,
	names: readonly LandmarkName[],
	options: GeometryOptions,
) =>
	readPoints(
		input.worldLandmarks,
		names,
		(joint) => [joint.x, joint.y, joint.z],
		options,
	);
const subtract = (left: Point, right: Point): Point => [
	left[0] - right[0],
	left[1] - right[1],
	left[2] - right[2],
];

const angle = (result: PointsResult): PoseMeasurement<"degrees"> => {
	if (result.status === "unavailable") return result;
	const [start, vertex, end] = result.points;
	if (!start || !vertex || !end)
		throw new Error("An angle requires three points");
	const first = subtract(start, vertex);
	const second = subtract(end, vertex);
	const firstLength = Math.hypot(...first);
	const secondLength = Math.hypot(...second);
	if (![firstLength, secondLength].every(Number.isFinite))
		return { status: "unavailable", reason: "invalid-coordinates" };
	if (firstLength === 0 || secondLength === 0)
		return { status: "unavailable", reason: "degenerate-angle" };
	const firstDirectionX = first[0] / firstLength;
	const firstDirectionY = first[1] / firstLength;
	const firstDirectionZ = first[2] / firstLength;
	const secondDirectionX = second[0] / secondLength;
	const secondDirectionY = second[1] / secondLength;
	const secondDirectionZ = second[2] / secondLength;
	const crossLength = Math.hypot(
		firstDirectionY * secondDirectionZ - firstDirectionZ * secondDirectionY,
		firstDirectionZ * secondDirectionX - firstDirectionX * secondDirectionZ,
		firstDirectionX * secondDirectionY - firstDirectionY * secondDirectionX,
	);
	const dot =
		firstDirectionX * secondDirectionX +
		firstDirectionY * secondDirectionY +
		firstDirectionZ * secondDirectionZ;
	return {
		status: "available",
		value: (Math.atan2(crossLength, dot) * 180) / Math.PI,
		unit: "degrees",
	};
};
const distance = <Unit extends "pixels" | "meters">(
	result: PointsResult,
	unit: Unit,
): PoseMeasurement<Unit> => {
	if (result.status === "unavailable") return result;
	const [start, end] = result.points;
	if (!start || !end) throw new Error("A distance requires two points");
	const value = Math.hypot(...subtract(start, end));
	if (!Number.isFinite(value))
		return { status: "unavailable", reason: "invalid-coordinates" };
	return { status: "available", value, unit };
};

export const getImageJointAngle = (
	input: ImageGeometryInput,
	start: LandmarkName,
	vertex: LandmarkName,
	end: LandmarkName,
	options: GeometryOptions = {},
): PoseMeasurement<"degrees"> =>
	angle(imagePoints(input, [start, vertex, end], options));
export const getWorldJointAngle = (
	input: WorldGeometryInput,
	start: LandmarkName,
	vertex: LandmarkName,
	end: LandmarkName,
	options: GeometryOptions = {},
): PoseMeasurement<"degrees"> =>
	angle(worldPoints(input, [start, vertex, end], options));
export const getImageDistance = (
	input: ImageGeometryInput,
	start: LandmarkName,
	end: LandmarkName,
	options: GeometryOptions = {},
): PoseMeasurement<"pixels"> =>
	distance(imagePoints(input, [start, end], options), "pixels");
export const getWorldDistance = (
	input: WorldGeometryInput,
	start: LandmarkName,
	end: LandmarkName,
	options: GeometryOptions = {},
): PoseMeasurement<"meters"> =>
	distance(worldPoints(input, [start, end], options), "meters");
