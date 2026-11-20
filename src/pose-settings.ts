export type PoseModel = "lite" | "full" | "heavy";

export type PoseDelegate = "gpu" | "cpu";

export interface PoseSettings {
	poseModel: PoseModel;
	poseDelegate: PoseDelegate;
	maxPoseCount: number;
	minPoseDetectionConfidence: number;
	minPosePresenceConfidence: number;
	minTrackingConfidence: number;
	poseModelPath: string | null;
}

export interface PoseSettingsRequest {
	poseModel?: string;
	poseDelegate?: string;
	maxPoseCount?: number;
	minPoseDetectionConfidence?: number;
	minPosePresenceConfidence?: number;
	minTrackingConfidence?: number;
	poseModelPath?: string | null;
}

export interface NativePoseImageSettings {
	personMaskEnabled: false;
	maskMaxDimension: 256;
	maxPoses: number;
	modelVariant: PoseModel;
	modelPath: string | null;
	maxImageDimension: 2048;
	minPoseDetectionConfidence: number;
	minPosePresenceConfidence: number;
	poseDelegate: PoseDelegate;
}

export function readPoseSettings(request: PoseSettingsRequest): PoseSettings {
	const poseModel = readPoseModel(request.poseModel ?? "full");
	const poseDelegate = readPoseDelegate(request.poseDelegate ?? "gpu");
	const maxPoseCount = readMaxPoseCount(request.maxPoseCount ?? 1);
	const minPoseDetectionConfidence = readConfidence(
		request.minPoseDetectionConfidence ?? 0.5,
		"minPoseDetectionConfidence",
	);
	const minPosePresenceConfidence = readConfidence(
		request.minPosePresenceConfidence ?? 0.5,
		"minPosePresenceConfidence",
	);
	const minTrackingConfidence = readConfidence(
		request.minTrackingConfidence ?? 0.5,
		"minTrackingConfidence",
	);
	const poseModelPath = readPoseModelPath(request.poseModelPath);

	return {
		poseModel,
		poseDelegate,
		maxPoseCount,
		minPoseDetectionConfidence,
		minPosePresenceConfidence,
		minTrackingConfidence,
		poseModelPath,
	};
}

export function readFrameRate(frameRate: number): number {
	const isWhole = Number.isInteger(frameRate);

	if (!isWhole) {
		throw new Error("Frame rate must be a whole number from 1 to 60.");
	}

	const isTooLow = frameRate < 1;

	if (isTooLow) {
		throw new Error("Frame rate must be a whole number from 1 to 60.");
	}

	const isTooHigh = frameRate > 60;

	if (isTooHigh) {
		throw new Error("Frame rate must be a whole number from 1 to 60.");
	}

	return frameRate;
}

export function createNativePoseImageSettings(
	poseSettings: PoseSettings,
): NativePoseImageSettings {
	return {
		personMaskEnabled: false,
		maskMaxDimension: 256,
		maxPoses: poseSettings.maxPoseCount,
		modelVariant: poseSettings.poseModel,
		modelPath: poseSettings.poseModelPath,
		maxImageDimension: 2048,
		minPoseDetectionConfidence: poseSettings.minPoseDetectionConfidence,
		minPosePresenceConfidence: poseSettings.minPosePresenceConfidence,
		poseDelegate: poseSettings.poseDelegate,
	};
}

function readPoseModel(poseModel: string): PoseModel {
	const isLite = poseModel === "lite";

	if (isLite) return "lite";

	const isFull = poseModel === "full";

	if (isFull) return "full";

	const isHeavy = poseModel === "heavy";

	if (isHeavy) return "heavy";

	throw new Error('Unknown pose model. Use "lite", "full", or "heavy".');
}

function readPoseDelegate(poseDelegate: string): PoseDelegate {
	const isGpu = poseDelegate === "gpu";

	if (isGpu) return "gpu";

	const isCpu = poseDelegate === "cpu";

	if (isCpu) return "cpu";

	throw new Error('Unknown pose delegate. Use "gpu" or "cpu".');
}

function readMaxPoseCount(maxPoseCount: number): number {
	const isWhole = Number.isInteger(maxPoseCount);

	if (!isWhole) {
		throw new Error("maxPoseCount must be a whole number from 1 to 6.");
	}

	const isTooLow = maxPoseCount < 1;

	if (isTooLow) {
		throw new Error("maxPoseCount must be a whole number from 1 to 6.");
	}

	const isTooHigh = maxPoseCount > 6;

	if (isTooHigh) {
		throw new Error("maxPoseCount must be a whole number from 1 to 6.");
	}

	return maxPoseCount;
}

function readConfidence(confidence: number, label: string): number {
	const isNotFinite = !Number.isFinite(confidence);

	if (isNotFinite) throw new Error(`${label} must be between 0 and 1.`);

	const isBelow = confidence < 0;

	if (isBelow) throw new Error(`${label} must be between 0 and 1.`);

	const isAbove = confidence > 1;

	if (isAbove) throw new Error(`${label} must be between 0 and 1.`);

	return confidence;
}

function readPoseModelPath(
	poseModelPath: string | null | undefined,
): string | null {
	const isMissing = poseModelPath == null;

	if (isMissing) return null;

	const isEmpty = poseModelPath === "";

	if (isEmpty) throw new Error("Pose model path must be a local file path.");

	return poseModelPath;
}
