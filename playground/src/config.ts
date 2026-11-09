import {
	BODY_PARTS,
	LANDMARK_NAMES,
	POSE_CONNECTIONS,
} from "expo-mediapipe-pose/core";
import { z } from "zod";

const number = (min: number, max: number) => z.number().min(min).max(max);
const integer = (min: number, max: number) => number(min, max).int();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const landmark = z.enum(LANDMARK_NAMES);
const connection = z.enum(
	POSE_CONNECTIONS.map(([a, b]) => `${a}:${b}` as const),
);
const bodyPart = z.enum(
	Object.keys(BODY_PARTS) as Array<keyof typeof BODY_PARTS>,
);
export const RuleSchema = z
	.strictObject({
		id: z.string().regex(/^[a-zA-Z0-9-]{1,64}$/),
		kind: z.enum(["angle", "distance", "height"]),
		space: z.enum(["image", "world"]),
		start: landmark,
		vertex: landmark,
		end: landmark,
		direction: z.enum(["below", "above"]),
		enterThreshold: number(-10000, 10000),
		exitThreshold: number(-10000, 10000),
		minVisibility: number(0, 1),
		holdMs: integer(0, 10000),
		staleAfterMs: integer(1, 30000),
		passColor: color,
		failColor: color,
		unknownColor: color,
	})
	.refine((rule) => rule.kind !== "height" || rule.space === "image")
	.refine((rule) =>
		rule.direction === "above"
			? rule.enterThreshold > rule.exitThreshold
			: rule.enterThreshold < rule.exitThreshold,
	);
export const ConfigSchema = z.strictObject({
	version: z.literal(1),
	detection: z.strictObject({
		minPoseDetectionConfidence: number(0, 1),
		minPosePresenceConfidence: number(0, 1),
		minTrackingConfidence: number(0, 1),
		maxPoses: integer(1, 6),
		segmentationEnabled: z.boolean(),
		maskMaxDimension: integer(64, 512),
		modelVariant: z.enum(["full", "lite", "heavy"]),
	}),
	timing: z.strictObject({
		frameLimit: integer(1, 60),
		callbackFps: integer(1, 60),
		previewFps: integer(1, 60),
	}),
	skeleton: z.strictObject({
		enabled: z.boolean(),
		poseIndex: integer(0, 5),
		color,
		jointRadius: number(0, 20),
		lineWidth: number(0, 15),
		minVisibility: number(0, 1),
		bodyParts: z.array(bodyPart),
		landmarks: z.array(landmark),
		joints: z.partialRecord(
			landmark,
			z.strictObject({ color, radius: number(0, 20) }),
		),
		connections: z.partialRecord(
			connection,
			z.strictObject({ color, width: number(0, 15) }),
		),
	}),
	mask: z.strictObject({ color, opacity: number(0, 1) }),
	rules: z
		.array(RuleSchema)
		.max(6)
		.refine(
			(rules) => new Set(rules.map((rule) => rule.id)).size === rules.length,
		),
	native: z.strictObject({
		cameraFacing: z.enum(["front", "back"]),
		cameraLens: z.enum(["auto", "wide", "ultraWide"]),
		cameraZoomFactor: number(1, 100),
	}),
});
export type Config = z.infer<typeof ConfigSchema>;
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
export function defaults(): Config {
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
			bodyParts: Object.keys(BODY_PARTS) as Array<keyof typeof BODY_PARTS>,
			landmarks: [...LANDMARK_NAMES],
			joints: {},
			connections: {},
		},
		mask: { color: "#22c55e", opacity: 0.5 },
		rules: [],
		native: { cameraFacing: "front", cameraLens: "auto", cameraZoomFactor: 1 },
	};
}
export function parseConfig(json: string): Config {
	if (json.length > 40000)
		throw new Error("Configuration exceeds 40,000 characters.");
	return ConfigSchema.parse(JSON.parse(json));
}
export function preset(name: string): Config {
	const config = defaults();
	if (name === "arms")
		return {
			...config,
			skeleton: {
				...config.skeleton,
				bodyParts: ["leftArm", "rightArm", "torso"],
			},
			rules: [defaultRule],
		};
	if (name === "multiple")
		return { ...config, detection: { ...config.detection, maxPoses: 2 } };
	if (name === "mask")
		return {
			...config,
			detection: { ...config.detection, segmentationEnabled: true },
		};
	return config;
}
export function configurationLink(config: Config): string {
	return `${location.origin}${location.pathname}#config=${encodeURIComponent(JSON.stringify(config))}`;
}
