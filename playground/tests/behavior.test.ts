import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
	createDetectionSkeleton,
	initialPoseRuleState,
	LANDMARK_NAMES,
	type Landmark,
} from "expo-mediapipe-pose/core";
import { generateCode } from "../src/codegen";
import { defaultRule, defaults, parseConfig, preset } from "../src/config";
import { frameAt, parseRecording } from "../src/recording";
import { updateRules } from "../src/rules";
import type { BrowserFrame } from "../src/types";

const landmark = (x: number, y: number): Landmark => ({
	x,
	y,
	z: 0,
	visibility: 1,
	presence: 1,
});
function frame(): BrowserFrame {
	const landmarks = LANDMARK_NAMES.map(() => landmark(0.5, 0.5));
	landmarks[11] = landmark(0.5, 0.1);
	landmarks[13] = landmark(0.5, 0.5);
	landmarks[15] = landmark(0.8, 0.5);
	return {
		landmarks,
		worldLandmarks: landmarks,
		poses: [{ landmarks, worldLandmarks: landmarks }],
		imageSize: { width: 800, height: 400 },
		inferenceDurationMs: 10,
	};
}
test("configurations preserve defaults and reject unsupported or executable content", () => {
	const config = defaults();
	assert.deepEqual(parseConfig(JSON.stringify(config)), config);
	assert.equal(config.detection.minTrackingConfidence, 0.35);
	assert.throws(() => parseConfig(JSON.stringify({ ...config, version: 2 })));
	assert.throws(() =>
		parseConfig(
			JSON.stringify({
				...config,
				rules: [{ ...defaultRule, evaluate: "alert(1)" }],
			}),
		),
	);
	assert.throws(() =>
		parseConfig(
			JSON.stringify({
				...config,
				skeleton: {
					...config.skeleton,
					joints: { imaginary: { color: "#ffffff", radius: 4 } },
				},
			}),
		),
	);
	assert.throws(() =>
		parseConfig(
			JSON.stringify({
				...config,
				rules: [{ ...defaultRule, enterThreshold: 100 }],
			}),
		),
	);
});
test("selection, confidence, geometry and rule hold semantics remain observable", () => {
	const detection = frame();
	const rule = { ...defaultRule, enterThreshold: 95, exitThreshold: 100 };
	const first = updateRules(
		detection,
		0,
		[rule],
		[initialPoseRuleState()],
		100,
	);
	assert.equal(first[0]?.status, "unknown");
	const held = updateRules(detection, 0, [rule], first, 400);
	assert.equal(held[0]?.status, "pass");
	assert.equal(
		updateRules(detection, 1, [rule], held, 500)[0]?.status,
		"unknown",
	);
	assert.equal(
		createDetectionSkeleton(
			detection,
			{ width: 400, height: 200 },
			{ poseIndex: 1 },
		).points.length,
		0,
	);
	assert.equal(detection.landmarks.length, 33);
});
test("browser recording validation, replay seeking and pixel exclusion", () => {
	const f = frame();
	const recording = parseRecording(
		JSON.stringify({
			format: "pose-playground",
			version: 1,
			frames: [
				{ timestampMs: 0, frame: f },
				{ timestampMs: 100, frame: { ...f, inferenceDurationMs: 20 } },
			],
		}),
	);
	assert.equal(frameAt(recording, 50)?.inferenceDurationMs, 10);
	assert.equal(frameAt(recording, 100)?.inferenceDurationMs, 20);
	assert.throws(() =>
		parseRecording(JSON.stringify({ ...recording, pixels: "private" })),
	);
	assert.throws(() =>
		parseRecording(
			JSON.stringify({ ...recording, frames: [...recording.frames].reverse() }),
		),
	);
	assert.throws(() =>
		parseRecording(JSON.stringify({ ...recording, frames: [] })),
	);
});
test("every generated integration compiles against the actual native API", () => {
	const directory = mkdtempSync(join(process.cwd(), ".generated-code-"));
	try {
		const config = preset("arms");
		const configured = {
			...config,
			detection: {
				...config.detection,
				modelVariant: "heavy" as const,
				segmentationEnabled: true,
			},
			rules: [
				defaultRule,
				{ ...defaultRule, kind: "distance" as const, space: "world" as const },
				{ ...defaultRule, kind: "height" as const },
			],
		};
		for (const mode of ["camera", "photo", "video"] as const)
			writeFileSync(
				join(directory, `${mode}.tsx`),
				generateCode(configured, mode),
			);
		writeFileSync(
			join(directory, "tsconfig.json"),
			JSON.stringify({
				extends: "../tsconfig.json",
				compilerOptions: {
					noUnusedLocals: false,
					noUnusedParameters: false,
					paths: {
						"expo-camera": [
							join(process.cwd(), "../example/node_modules/expo-camera"),
						],
					},
				},
				include: ["*.tsx"],
			}),
		);
		execFileSync(
			"pnpm",
			["exec", "tsc", "--noEmit", "-p", join(directory, "tsconfig.json")],
			{ encoding: "utf8" },
		);
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
});

test("custom full models and segmentation styles are reflected in exported code", () => {
	const config = preset("mask");
	const code = generateCode(config, "camera", true);
	assert.match(
		code,
		/poseModelAssetPath="\/absolute\/path\/to\/your-model.task"/,
	);
	assert.match(code, /PoseSegmentationOverlay segmentation=/);
	assert.match(code, /color="#22c55e" opacity=\{0.5\}/);
	assert.match(code, /useLayoutEffect/);
});
