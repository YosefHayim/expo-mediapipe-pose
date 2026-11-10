import {
	type BODY_PARTS,
	LANDMARK_NAMES,
	POSE_CONNECTIONS,
} from "expo-mediapipe-pose/core";
import { z } from "zod";

const createNumberSchema = (min: number, max: number) =>
	z.number().min(min).max(max);
const createIntegerSchema = (min: number, max: number) =>
	createNumberSchema(min, max).int();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const landmark = z.enum(LANDMARK_NAMES);
const connection = z.enum(
	POSE_CONNECTIONS.map(([a, b]) => `${a}:${b}` as const),
);
const BODY_PART_NAMES = [
	"face",
	"leftArm",
	"rightArm",
	"leftWrist",
	"rightWrist",
	"torso",
	"leftLeg",
	"rightLeg",
	"leftAnkle",
	"rightAnkle",
] as const satisfies readonly (keyof typeof BODY_PARTS)[];
const bodyPart = z.enum(BODY_PART_NAMES);
export const RuleSchema = z
	.strictObject({
		id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
		kind: z.enum(["angle", "distance", "height"]),
		space: z.enum(["image", "world"]),
		start: landmark,
		vertex: landmark,
		end: landmark,
		direction: z.enum(["below", "above"]),
		enterThreshold: createNumberSchema(-10000, 10000),
		exitThreshold: createNumberSchema(-10000, 10000),
		minVisibility: createNumberSchema(0, 1),
		holdMs: createIntegerSchema(0, 10000),
		staleAfterMs: createIntegerSchema(1, 30000),
		passColor: color,
		failColor: color,
		unknownColor: color,
	})
	.refine((rule) => rule.kind !== "height" || rule.space === "image")
	.refine((rule) => {
		const isRuleDirectionAbove = rule.direction === "above";
		return isRuleDirectionAbove
			? rule.enterThreshold > rule.exitThreshold
			: rule.enterThreshold < rule.exitThreshold;
	});
export const SettingsSchema = z.strictObject({
	version: z.literal(1),
	detection: z.strictObject({
		minPoseDetectionConfidence: createNumberSchema(0, 1),
		minPosePresenceConfidence: createNumberSchema(0, 1),
		minTrackingConfidence: createNumberSchema(0, 1),
		maxPoses: createIntegerSchema(1, 6),
		segmentationEnabled: z.boolean(),
		maskMaxDimension: createIntegerSchema(64, 512),
		modelVariant: z.enum(["full", "lite", "heavy"]),
	}),
	timing: z.strictObject({
		frameLimit: createIntegerSchema(1, 60),
		callbackFps: createIntegerSchema(1, 60),
		previewFps: createIntegerSchema(1, 60),
	}),
	skeleton: z.strictObject({
		enabled: z.boolean(),
		poseIndex: createIntegerSchema(0, 5),
		color,
		jointRadius: createNumberSchema(0, 20),
		lineWidth: createNumberSchema(0, 15),
		minVisibility: createNumberSchema(0, 1),
		bodyParts: z.array(bodyPart),
		landmarks: z.array(landmark),
		joints: z.partialRecord(
			landmark,
			z.strictObject({ color, radius: createNumberSchema(0, 20) }),
		),
		connections: z.partialRecord(
			connection,
			z.strictObject({ color, width: createNumberSchema(0, 15) }),
		),
	}),
	mask: z.strictObject({ color, opacity: createNumberSchema(0, 1) }),
	rules: z
		.array(RuleSchema)
		.max(6)
		.refine(
			(rules) => new Set(rules.map((rule) => rule.id)).size === rules.length,
		),
	native: z.strictObject({
		cameraFacing: z.enum(["front", "back"]),
		cameraLens: z.enum(["auto", "wide", "ultraWide"]),
		cameraZoomFactor: createNumberSchema(1, 100),
	}),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export const defaultRule: Rule = {
	id: "elbow-rule",
	kind: "angle",
	space: "image",
	start: "leftShoulder",
	vertex: "leftElbow",
	end: "leftWrist",
	direction: "below",
	enterThreshold: 85,
	exitThreshold: 95,
	minVisibility: 0.6,
	holdMs: 250,
	staleAfterMs: 500,
	passColor: "#22c55e",
	failColor: "#ef4444",
	unknownColor: "#94a3b8",
};
export const createDefaultSettings = (): Settings => {
	return {
		version: 1,
		detection: {
			minPoseDetectionConfidence: 0.35,
			minPosePresenceConfidence: 0.35,
			minTrackingConfidence: 0.35,
			maxPoses: 1,
			segmentationEnabled: false,
			maskMaxDimension: 256,
			modelVariant: "full",
		},
		timing: { frameLimit: 30, callbackFps: 30, previewFps: 30 },
		skeleton: {
			enabled: true,
			poseIndex: 0,
			color: "#22c55e",
			jointRadius: 4,
			lineWidth: 3,
			minVisibility: 0.5,
			bodyParts: [...BODY_PART_NAMES],
			landmarks: [...LANDMARK_NAMES],
			joints: {},
			connections: {},
		},
		mask: { color: "#22c55e", opacity: 0.5 },
		rules: [],
		native: { cameraFacing: "front", cameraLens: "auto", cameraZoomFactor: 1 },
	};
};
export const parseSettings = (serializedSettings: string): Settings => {
	const maximumSettingsCharacters = 40000;

	const isTooLong = serializedSettings.length > maximumSettingsCharacters;
	if (isTooLong) throw new Error("Configuration exceeds 40,000 characters.");

	const parsedSettings: unknown = JSON.parse(serializedSettings);
	return SettingsSchema.parse(parsedSettings);
};
export const readPresetSettings = (name: string): Settings => {
	const settings = createDefaultSettings();

	const isNameArms = name === "arms";
	if (isNameArms)
		return {
			...settings,
			skeleton: {
				...settings.skeleton,
				bodyParts: ["leftArm", "rightArm", "torso"],
			},
			rules: [defaultRule],
		};

	const isNameMultiple = name === "multiple";
	if (isNameMultiple)
		return { ...settings, detection: { ...settings.detection, maxPoses: 2 } };

	const isNameMask = name === "mask";
	if (isNameMask)
		return {
			...settings,
			detection: { ...settings.detection, segmentationEnabled: true },
		};

	return settings;
};
export const createConfigurationLink = (settings: Settings): string => {
	return `${location.origin}${location.pathname}#config=${encodeURIComponent(JSON.stringify(settings))}`;
};
