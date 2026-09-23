import type { Landmark, PoseFrame } from "../contracts";

/** MediaPipe's anatomical names, in the order returned by Pose Landmarker. */
export const LANDMARK_NAMES = [
	"nose",
	"leftEyeInner",
	"leftEye",
	"leftEyeOuter",
	"rightEyeInner",
	"rightEye",
	"rightEyeOuter",
	"leftEar",
	"rightEar",
	"mouthLeft",
	"mouthRight",
	"leftShoulder",
	"rightShoulder",
	"leftElbow",
	"rightElbow",
	"leftWrist",
	"rightWrist",
	"leftPinky",
	"rightPinky",
	"leftIndex",
	"rightIndex",
	"leftThumb",
	"rightThumb",
	"leftHip",
	"rightHip",
	"leftKnee",
	"rightKnee",
	"leftAnkle",
	"rightAnkle",
	"leftHeel",
	"rightHeel",
	"leftFootIndex",
	"rightFootIndex",
] as const;

export type LandmarkName = (typeof LANDMARK_NAMES)[number];

export const POSE_CONNECTIONS = [
	["nose", "leftEyeInner"],
	["leftEyeInner", "leftEye"],
	["leftEye", "leftEyeOuter"],
	["leftEyeOuter", "leftEar"],
	["nose", "rightEyeInner"],
	["rightEyeInner", "rightEye"],
	["rightEye", "rightEyeOuter"],
	["rightEyeOuter", "rightEar"],
	["mouthLeft", "mouthRight"],
	["leftShoulder", "rightShoulder"],
	["leftShoulder", "leftElbow"],
	["leftElbow", "leftWrist"],
	["leftWrist", "leftPinky"],
	["leftWrist", "leftIndex"],
	["leftWrist", "leftThumb"],
	["leftPinky", "leftIndex"],
	["rightShoulder", "rightElbow"],
	["rightElbow", "rightWrist"],
	["rightWrist", "rightPinky"],
	["rightWrist", "rightIndex"],
	["rightWrist", "rightThumb"],
	["rightPinky", "rightIndex"],
	["leftShoulder", "leftHip"],
	["rightShoulder", "rightHip"],
	["leftHip", "rightHip"],
	["leftHip", "leftKnee"],
	["leftKnee", "leftAnkle"],
	["leftAnkle", "leftHeel"],
	["leftHeel", "leftFootIndex"],
	["leftAnkle", "leftFootIndex"],
	["rightHip", "rightKnee"],
	["rightKnee", "rightAnkle"],
	["rightAnkle", "rightHeel"],
	["rightHeel", "rightFootIndex"],
	["rightAnkle", "rightFootIndex"],
] as const satisfies readonly (readonly [LandmarkName, LandmarkName])[];

type ConnectionNameOf<Pair> = Pair extends readonly [
	infer From extends LandmarkName,
	infer To extends LandmarkName,
]
	? `${From}:${To}`
	: never;

export type ConnectionName = ConnectionNameOf<
	(typeof POSE_CONNECTIONS)[number]
>;

export const BODY_PARTS = {
	face: LANDMARK_NAMES.slice(0, 11),
	leftArm: ["leftShoulder", "leftElbow", "leftWrist"],
	rightArm: ["rightShoulder", "rightElbow", "rightWrist"],
	leftWrist: ["leftWrist", "leftPinky", "leftIndex", "leftThumb"],
	rightWrist: ["rightWrist", "rightPinky", "rightIndex", "rightThumb"],
	torso: ["leftShoulder", "rightShoulder", "leftHip", "rightHip"],
	leftLeg: ["leftHip", "leftKnee", "leftAnkle"],
	rightLeg: ["rightHip", "rightKnee", "rightAnkle"],
	leftAnkle: ["leftAnkle", "leftHeel", "leftFootIndex"],
	rightAnkle: ["rightAnkle", "rightHeel", "rightFootIndex"],
} as const satisfies Record<string, readonly LandmarkName[]>;

export type BodyPart = keyof typeof BODY_PARTS;

export const getLandmark = (
	frame: PoseFrame,
	name: LandmarkName,
): Landmark | undefined => frame.landmarks[LANDMARK_NAMES.indexOf(name)];

export const getNamedLandmarks = (
	frame: PoseFrame,
): Partial<Record<LandmarkName, Landmark>> => {
	const named: Partial<Record<LandmarkName, Landmark>> = {};
	LANDMARK_NAMES.forEach((name, index) => {
		const landmark = frame.landmarks[index];
		if (landmark) named[name] = landmark;
	});
	return named;
};
