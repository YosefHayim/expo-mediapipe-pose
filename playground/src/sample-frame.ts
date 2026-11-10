import { LANDMARK_NAMES, type Landmark } from "expo-mediapipe-pose/core";
import type { BrowserFrame } from "./types";

const createLandmark = (x: number, y: number): Landmark => ({
	x,
	y,
	z: 0,
	visibility: 1,
	presence: 1,
});

export const createSampleBrowserFrame = (): BrowserFrame => {
	const landmarks = LANDMARK_NAMES.map(() => createLandmark(0.5, 0.5));
	landmarks[11] = createLandmark(0.5, 0.1);
	landmarks[13] = createLandmark(0.5, 0.5);
	landmarks[15] = createLandmark(0.8, 0.5);

	return {
		landmarks,
		worldLandmarks: landmarks,
		poses: [{ landmarks, worldLandmarks: landmarks }],
		imageSize: { width: 800, height: 400 },
		inferenceDurationMs: 10,
	};
};
