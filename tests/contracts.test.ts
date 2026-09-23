import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Either, Schema } from "effect";

import {
	CameraConfiguration,
	InferenceError,
	PoseFrame,
} from "../src/contracts";

const frameMetadata = {
	width: 720,
	height: 1280,
	cameraFacing: "front",
	cameraLens: "wide",
	cameraMirrored: true,
	cameraZoomFactor: 1,
	receivedAtMs: 1_700_000_000_000,
	frameNumber: 1,
	inferenceDurationMs: 12,
	luminance: 0.5,
	poseCount: 0,
	poseModelDelegate: "GPU",
	poseModelSource: "bundled",
	poseModelVariant: "full",
	thermalState: "nominal",
};

describe("Pose camera wire contracts", () => {
	it("delivers an empty detection without confusing it with a camera failure", () => {
		const frame = Schema.decodeUnknownSync(PoseFrame)({
			landmarks: [],
			worldLandmarks: [],
			additionalData: frameMetadata,
		});
		assert.deepEqual(frame.landmarks, []);
		assert.equal(frame.additionalData.poseCount, 0);
	});

	it("preserves offscreen coordinates and optional joint confidence for scoring", () => {
		const joint = { x: -0.2, y: 1.2, z: -0.5, visibility: 0.35 };
		const frame = Schema.decodeUnknownSync(PoseFrame)({
			landmarks: [joint],
			worldLandmarks: [joint],
			additionalData: { ...frameMetadata, poseCount: 1 },
		});
		assert.deepEqual(frame.landmarks[0], joint);
		assert.equal(Object.hasOwn(frame.landmarks[0] ?? {}, "presence"), false);
	});

	it("rejects non-finite coordinates and invalid confidence before scoring", () => {
		for (const joint of [
			{ x: NaN, y: 0, z: 0 },
			{ x: 0, y: 0, z: 0, visibility: -1 },
			{ x: 0, y: 0, z: Infinity },
		]) {
			const decodedFrame = Schema.decodeUnknownEither(PoseFrame)({
				landmarks: [joint],
				worldLandmarks: [],
				additionalData: frameMetadata,
			});
			assert.equal(Either.isLeft(decodedFrame), true);
		}
	});

	it("accepts local model telemetry for both native delegates", () => {
		for (const poseModelVariant of ["lite", "full", "heavy"]) {
			for (const poseModelDelegate of ["CPU", "GPU"]) {
				const decodedFrame = Schema.decodeUnknownEither(PoseFrame)({
					landmarks: [],
					worldLandmarks: [],
					additionalData: {
						...frameMetadata,
						poseModelVariant,
						poseModelDelegate,
						poseModelSource: "local",
					},
				});
				assert.equal(Either.isRight(decodedFrame), true);
			}
		}
	});

	it("rejects invalid capture dimensions and sub-one applied zoom", () => {
		const configuration = {
			effectiveFacing: "front",
			effectiveLens: "wide",
			appliedZoomFactor: 1,
			mirrored: true,
			captureWidth: 720,
			captureHeight: 1280,
		};
		assert.equal(
			Either.isRight(
				Schema.decodeUnknownEither(CameraConfiguration)(configuration),
			),
			true,
		);
		assert.equal(
			Either.isLeft(
				Schema.decodeUnknownEither(CameraConfiguration)({
					...configuration,
					captureWidth: 0,
				}),
			),
			true,
		);
		assert.equal(
			Either.isLeft(
				Schema.decodeUnknownEither(CameraConfiguration)({
					...configuration,
					appliedZoomFactor: 0.5,
				}),
			),
			true,
		);
	});

	it("keeps native failures limited to stable codes without device paths or messages", () => {
		const failure = Schema.decodeUnknownSync(InferenceError)({
			code: "modelInitialization",
			message: "/private/model.task",
		});
		assert.deepEqual(failure, { code: "modelInitialization" });
		assert.equal(
			Either.isLeft(
				Schema.decodeUnknownEither(InferenceError)({ code: "unknown" }),
			),
			true,
		);
	});
});
