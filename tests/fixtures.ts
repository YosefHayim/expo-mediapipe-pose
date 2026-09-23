import type { PoseFrame } from "../src/core";
import { LANDMARK_NAMES } from "../src/core";

export const poseFrame = (): PoseFrame => ({
	landmarks: LANDMARK_NAMES.map(() => ({
		x: 0.5,
		y: 0.5,
		z: 0,
		visibility: 0.9,
	})),
	worldLandmarks: [],
	additionalData: {
		width: 720,
		height: 1280,
		cameraFacing: "front",
		cameraLens: "wide",
		cameraMirrored: true,
		cameraZoomFactor: 1,
		receivedAtMs: 1700000000000,
		frameNumber: 1,
		inferenceDurationMs: 12,
		luminance: 0.5,
		poseCount: 1,
		poseModelDelegate: "GPU",
		poseModelSource: "bundled",
		poseModelVariant: "full",
		thermalState: "nominal",
	},
});
