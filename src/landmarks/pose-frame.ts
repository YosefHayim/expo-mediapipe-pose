import { LANDMARK_NAMES, type LandmarkName } from "./landmark-names";

export interface LandmarkPoint {
	x: number;
	y: number;
	z: number;
	visibility: number;
	presence: number;
}

export type NamedLandmarks = Record<LandmarkName, LandmarkPoint | null>;

export interface NamedPose {
	landmarks: NamedLandmarks;
	worldLandmarks: NamedLandmarks;
}

export type CameraFacing = "front" | "back";

export interface PoseFrame {
	landmarks: NamedLandmarks;
	worldLandmarks: NamedLandmarks;
	poses: NamedPose[];
	timestampMs: number;
	imageWidth: number;
	imageHeight: number;
	cameraFacing: CameraFacing | null;
}

export interface ImagePoint {
	x: number;
	y: number;
}

export interface ViewSize {
	width: number;
	height: number;
}

export function pointInImage(
	point: LandmarkPoint,
	imageWidth: number,
	imageHeight: number,
): ImagePoint {
	return {
		x: point.x * imageWidth,
		y: point.y * imageHeight,
	};
}

export function placeLandmarkInView(
	point: LandmarkPoint,
	image: ViewSize,
	view: ViewSize,
): ImagePoint {
	const hasInvalidDimension = [
		image.width,
		image.height,
		view.width,
		view.height,
	].some(isNotPositiveFinite);

	if (hasInvalidDimension) {
		throw new RangeError(
			"Image and view dimensions must be finite and positive",
		);
	}

	const scale = Math.max(view.width / image.width, view.height / image.height);
	const drawnWidth = image.width * scale;
	const drawnHeight = image.height * scale;

	return {
		x: point.x * drawnWidth + (view.width - drawnWidth) / 2,
		y: point.y * drawnHeight + (view.height - drawnHeight) / 2,
	};
}

export function readPoseFrame(nativeEvent: unknown): PoseFrame | null {
	const isEvent = isPlainObject(nativeEvent);

	if (!isEvent) return null;

	const detection = nativeEvent.detection;
	const isVideoStep = isPlainObject(detection);

	if (isVideoStep) return readVideoPoseFrame(nativeEvent, detection);

	return readCameraOrPhotoFrame(nativeEvent);
}

function readVideoPoseFrame(
	step: Record<string, unknown>,
	detection: Record<string, unknown>,
): PoseFrame | null {
	const timestampMs = readFiniteNumber(step.timestampMs);

	if (timestampMs == null) return null;

	return readLandmarkFrame(detection, timestampMs, null);
}

function readCameraOrPhotoFrame(
	nativeEvent: Record<string, unknown>,
): PoseFrame | null {
	const extra = nativeEvent.additionalData;
	const isCamera = isPlainObject(extra);

	if (isCamera) return readCameraFrame(nativeEvent, extra);

	return readLandmarkFrame(nativeEvent, 0, null);
}

function readCameraFrame(
	nativeEvent: Record<string, unknown>,
	extra: Record<string, unknown>,
): PoseFrame | null {
	const timestampMs = readFiniteNumber(extra.receivedAtMs);

	if (timestampMs == null) return null;

	const cameraFacing = readCameraFacing(extra.cameraFacing);
	const image = readViewSize(extra.width, extra.height);

	if (image == null) return null;

	const people = readPeople(nativeEvent);

	if (people == null) return null;

	return {
		landmarks: people.landmarks,
		worldLandmarks: people.worldLandmarks,
		poses: people.poses,
		timestampMs,
		imageWidth: image.width,
		imageHeight: image.height,
		cameraFacing,
	};
}

function readLandmarkFrame(
	holder: Record<string, unknown>,
	timestampMs: number,
	cameraFacing: CameraFacing | null,
): PoseFrame | null {
	const image = readImageSize(holder);

	if (image == null) return null;

	const people = readPeople(holder);

	if (people == null) return null;

	return {
		landmarks: people.landmarks,
		worldLandmarks: people.worldLandmarks,
		poses: people.poses,
		timestampMs,
		imageWidth: image.width,
		imageHeight: image.height,
		cameraFacing,
	};
}

function readImageSize(holder: Record<string, unknown>): ViewSize | null {
	const imageSize = holder.imageSize;
	const hasImageSize = isPlainObject(imageSize);

	if (hasImageSize) return readViewSize(imageSize.width, imageSize.height);

	return readViewSize(holder.width, holder.height);
}

interface People {
	landmarks: NamedLandmarks;
	worldLandmarks: NamedLandmarks;
	poses: NamedPose[];
}

function readPeople(holder: Record<string, unknown>): People | null {
	const landmarks = readNamedLandmarks(holder.landmarks);

	if (landmarks == null) return null;

	const worldLandmarks = readNamedLandmarks(holder.worldLandmarks);

	if (worldLandmarks == null) return null;

	const poseList = holder.poses;
	const isPoseList = Array.isArray(poseList);

	if (!isPoseList) {
		return {
			landmarks,
			worldLandmarks,
			poses: [{ landmarks, worldLandmarks }],
		};
	}

	const poses: NamedPose[] = [];

	for (const candidate of poseList) {
		const pose = readNamedPose(candidate);

		if (pose == null) return null;

		poses.push(pose);
	}

	const isPoseListEmpty = poses.length === 0;

	if (isPoseListEmpty) return { landmarks, worldLandmarks, poses };

	const firstPose = poses[0];

	if (firstPose == null) return null;

	return {
		landmarks: firstPose.landmarks,
		worldLandmarks: firstPose.worldLandmarks,
		poses,
	};
}

function readNamedPose(candidate: unknown): NamedPose | null {
	const isPose = isPlainObject(candidate);

	if (!isPose) return null;

	const landmarks = readNamedLandmarks(candidate.landmarks);

	if (landmarks == null) return null;

	const worldLandmarks = readNamedLandmarks(candidate.worldLandmarks);

	if (worldLandmarks == null) return null;

	return { landmarks, worldLandmarks };
}

function readNamedLandmarks(points: unknown): NamedLandmarks | null {
	const isList = Array.isArray(points);

	if (!isList) return null;

	const named = createEmptyLandmarks();

	for (const [index, landmarkName] of LANDMARK_NAMES.entries()) {
		named[landmarkName] = readLandmarkPoint(points[index]);
	}

	return named;
}

function createEmptyLandmarks(): NamedLandmarks {
	const named: Partial<NamedLandmarks> = {};

	for (const landmarkName of LANDMARK_NAMES) {
		named[landmarkName] = null;
	}

	return named as NamedLandmarks;
}

function readLandmarkPoint(candidate: unknown): LandmarkPoint | null {
	const isPoint = isPlainObject(candidate);

	if (!isPoint) return null;

	const x = readFiniteNumber(candidate.x);

	if (x == null) return null;

	const y = readFiniteNumber(candidate.y);

	if (y == null) return null;

	const z = readFiniteNumber(candidate.z);

	if (z == null) return null;

	const visibility = readUnitInterval(candidate.visibility);

	if (visibility == null) return null;

	const presence = readUnitInterval(candidate.presence);

	if (presence == null) return null;

	return { x, y, z, visibility, presence };
}

function readCameraFacing(candidate: unknown): CameraFacing | null {
	const isFront = candidate === "front";

	if (isFront) return "front";

	const isBack = candidate === "back";

	if (isBack) return "back";

	return null;
}

function readViewSize(
	widthCandidate: unknown,
	heightCandidate: unknown,
): ViewSize | null {
	const width = readFiniteNumber(widthCandidate);
	const height = readFiniteNumber(heightCandidate);
	const isWidthMissing = width == null;

	if (isWidthMissing) return null;

	const isHeightMissing = height == null;

	if (isHeightMissing) return null;

	const isWidthTooSmall = width <= 0;

	if (isWidthTooSmall) return null;

	const isHeightTooSmall = height <= 0;

	if (isHeightTooSmall) return null;

	return { width, height };
}

function readFiniteNumber(candidate: unknown): number | null {
	const isNumber = typeof candidate === "number";

	if (!isNumber) return null;

	const isFiniteNumber = Number.isFinite(candidate);

	if (!isFiniteNumber) return null;

	return candidate;
}

function readUnitInterval(candidate: unknown): number | null {
	const number = readFiniteNumber(candidate);
	const isMissing = number == null;

	if (isMissing) return null;

	const isBelow = number < 0;

	if (isBelow) return null;

	const isAbove = number > 1;

	if (isAbove) return null;

	return number;
}

function isPlainObject(
	candidate: unknown,
): candidate is Record<string, unknown> {
	const isObject = typeof candidate === "object";

	if (!isObject) return false;

	const isNull = candidate == null;

	if (isNull) return false;

	const isArray = Array.isArray(candidate);

	if (isArray) return false;

	return true;
}

function isNotPositiveFinite(amount: number): boolean {
	const isFiniteNumber = Number.isFinite(amount);

	if (!isFiniteNumber) return true;

	const isTooSmall = amount <= 0;

	if (isTooSmall) return true;

	return false;
}
