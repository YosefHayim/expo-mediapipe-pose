import { type PoseFrame, readPoseFrame } from "./landmarks/pose-frame";
import { loadPoseModule, type PoseNativeModule } from "./pose-module";
import {
	createNativePoseImageSettings,
	type PoseSettingsRequest,
	readFrameRate,
	readPoseSettings,
} from "./pose-settings";
import { listSampleTimestamps } from "./video-sample";

export interface PosePhotoRequest extends PoseSettingsRequest {
	path: string;
}

export interface PoseVideoRequest extends PosePhotoRequest {
	sampleFrameRate?: number;
}

export async function readPosePhoto(
	photo: PosePhotoRequest,
): Promise<PoseFrame> {
	readLocalPath(photo.path);

	const poseSettings = readPoseSettings(photo);
	const poseModule = loadPoseModule();

	let nativeReply: unknown;

	try {
		nativeReply = await poseModule.analyzePoseImage(
			photo.path,
			createNativePoseImageSettings(poseSettings),
		);
	} catch (error) {
		throw new Error(`Could not read a pose from ${photo.path}.`, {
			cause: error,
		});
	}

	const poseFrame = readPoseFrame(nativeReply);
	const isFrameMissing = poseFrame == null;

	if (isFrameMissing) {
		throw new Error(`Could not read a pose from ${photo.path}.`);
	}

	return poseFrame;
}

export async function readPoseVideo(
	video: PoseVideoRequest,
): Promise<PoseFrame[]> {
	readLocalPath(video.path);

	const poseSettings = readPoseSettings(video);
	const checkedRate = readFrameRate(video.sampleFrameRate ?? 5);
	const poseModule = loadPoseModule();
	const nativeSettings = createNativePoseImageSettings(poseSettings);

	let opened: unknown;

	try {
		opened = await poseModule.openPoseVideo(
			video.path,
			nativeSettings,
			poseSettings.minTrackingConfidence,
		);
	} catch (error) {
		throw new Error(`Could not read a pose from ${video.path}.`, {
			cause: error,
		});
	}

	const session = readVideoSession(opened);
	const isSessionMissing = session == null;

	if (isSessionMissing) {
		throw new Error(`Could not read a pose from ${video.path}.`);
	}

	const timestamps = listSampleTimestamps(session.durationMs, checkedRate);
	const poseFrames: PoseFrame[] = [];

	try {
		for (const timestampMs of timestamps) {
			const nativeStep = await poseModule.readPoseVideoFrame(
				session.id,
				timestampMs,
			);
			const poseFrame = readPoseFrame(nativeStep);
			const isFrameMissing = poseFrame == null;

			if (isFrameMissing) {
				throw new Error(`Could not read a pose from ${video.path}.`);
			}

			poseFrames.push(poseFrame);
		}
	} catch (error) {
		await closePoseVideoAfterFailure(poseModule, session.id, video.path, error);
	}

	try {
		await poseModule.closePoseVideo(session.id);
	} catch (error) {
		throw new Error(`Could not read a pose from ${video.path}.`, {
			cause: error,
		});
	}

	return poseFrames;
}

async function closePoseVideoAfterFailure(
	poseModule: PoseNativeModule,
	sessionId: string,
	path: string,
	error: unknown,
): Promise<never> {
	try {
		await poseModule.closePoseVideo(sessionId);
	} catch (closeError) {
		throw new AggregateError(
			[error, closeError],
			`Could not read a pose from ${path}.`,
		);
	}

	const isError = error instanceof Error;

	if (isError) throw error;

	throw new Error(`Could not read a pose from ${path}.`, { cause: error });
}

function readLocalPath(path: string): void {
	const isEmpty = path === "";

	if (isEmpty) throw new Error("Could not read a pose from .");
}

interface VideoSession {
	id: string;
	durationMs: number;
}

function readVideoSession(opened: unknown): VideoSession | null {
	const isOpened = isPlainObject(opened);

	if (!isOpened) return null;

	const id = opened.id;
	const isId = typeof id === "string";

	if (!isId) return null;

	const isIdEmpty = id === "";

	if (isIdEmpty) return null;

	const durationMs = readPositiveNumber(opened.durationMs);

	if (durationMs == null) return null;

	return { id, durationMs };
}

function readPositiveNumber(candidate: unknown): number | null {
	const isNumber = typeof candidate === "number";

	if (!isNumber) return null;

	const isFiniteNumber = Number.isFinite(candidate);

	if (!isFiniteNumber) return null;

	const isNotPositive = candidate <= 0;

	if (isNotPositive) return null;

	return candidate;
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
