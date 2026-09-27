import { Schema } from "effect";
import {
	BODY_PARTS,
	LANDMARK_NAMES,
	POSE_CONNECTIONS,
} from "expo-mediapipe-pose/core";

const number = (min: number, max: number) =>
	Schema.Number.pipe(Schema.finite(), Schema.between(min, max));
const integer = (min: number, max: number) =>
	number(min, max).pipe(Schema.int());
const color = Schema.String.pipe(Schema.pattern(/^#[0-9a-fA-F]{6}$/));
const landmark = Schema.Literal(...LANDMARK_NAMES);
const connection = Schema.Literal(
	...POSE_CONNECTIONS.map(([a, b]) => `${a}:${b}` as const),
);
const bodyPart = Schema.Literal(
	...(Object.keys(BODY_PARTS) as Array<keyof typeof BODY_PARTS>),
);
export const RuleSchema = Schema.Struct({
	id: Schema.String.pipe(Schema.pattern(/^[a-zA-Z0-9-]{1,64}$/)),
	kind: Schema.Literal("angle", "distance", "height"),
	space: Schema.Literal("image", "world"),
	start: landmark,
	vertex: landmark,
	end: landmark,
	direction: Schema.Literal("below", "above"),
	enterThreshold: number(-10000, 10000),
	exitThreshold: number(-10000, 10000),
	minVisibility: number(0, 1),
	holdMs: integer(0, 10000),
	staleAfterMs: integer(1, 30000),
	passColor: color,
	failColor: color,
	unknownColor: color,
}).pipe(
	Schema.filter((r) => r.kind !== "height" || r.space === "image"),
	Schema.filter((r) =>
		r.direction === "above"
			? r.enterThreshold > r.exitThreshold
			: r.enterThreshold < r.exitThreshold,
	),
);
export const ConfigSchema = Schema.Struct({
	version: Schema.Literal(1),
	detection: Schema.Struct({
		minPoseDetectionConfidence: number(0, 1),
		minPosePresenceConfidence: number(0, 1),
		minTrackingConfidence: number(0, 1),
		maxPoses: integer(1, 6),
		segmentationEnabled: Schema.Boolean,
		maskMaxDimension: integer(64, 512),
		modelVariant: Schema.Literal("full", "lite", "heavy"),
	}),
	timing: Schema.Struct({
		frameLimit: integer(1, 60),
		callbackFps: integer(1, 60),
		previewFps: integer(1, 60),
	}),
	skeleton: Schema.Struct({
		enabled: Schema.Boolean,
		poseIndex: integer(0, 5),
		color,
		jointRadius: number(0, 20),
		lineWidth: number(0, 15),
		minVisibility: number(0, 1),
		bodyParts: Schema.Array(bodyPart),
		landmarks: Schema.Array(landmark),
		joints: Schema.partial(
			Schema.Record({
				key: landmark,
				value: Schema.Struct({ color, radius: number(0, 20) }),
			}),
		),
		connections: Schema.partial(
			Schema.Record({
				key: connection,
				value: Schema.Struct({ color, width: number(0, 15) }),
			}),
		),
	}),
	mask: Schema.Struct({ color, opacity: number(0, 1) }),
	rules: Schema.Array(RuleSchema).pipe(
		Schema.maxItems(6),
		Schema.filter(
			(rules) => new Set(rules.map((rule) => rule.id)).size === rules.length,
		),
	),
	native: Schema.Struct({
		cameraFacing: Schema.Literal("front", "back"),
		cameraLens: Schema.Literal("auto", "wide", "ultraWide"),
		cameraZoomFactor: number(1, 100),
	}),
});
export type Config = Schema.Schema.Type<typeof ConfigSchema>;
export type Rule = Schema.Schema.Type<typeof RuleSchema>;
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
	return Schema.decodeUnknownSync(ConfigSchema, { onExcessProperty: "error" })(
		JSON.parse(json),
	);
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
