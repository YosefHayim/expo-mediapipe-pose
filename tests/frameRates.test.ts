import { strict as assert } from "node:assert";
import { it } from "node:test";
import { Schema } from "effect";
import { PosePerformanceMetrics, validateFrameRates } from "../src/core";

it("accepts independent rates and rejects invalid public rate settings", () => {
	validateFrameRates({ frameLimit: 15, previewFps: 60, callbackFps: 5 });
	for (const name of ["frameLimit", "previewFps", "callbackFps"]) {
		for (const value of [0, 61, 1.5, NaN, Infinity]) {
			assert.throws(
				() =>
					validateFrameRates({
						frameLimit: 30,
						previewFps: 30,
						callbackFps: 30,
						[name]: value,
					}),
				RangeError,
			);
		}
	}
});

it("decodes measured performance and preserves unavailable average duration", () => {
	const snapshot = {
		intervalMs: 1000,
		observedFrames: 60,
		inferenceCount: 15,
		resultCount: 5,
		skippedInferenceFrames: 45,
		observedFps: 60,
		inferenceFps: 15,
		resultFps: 5,
		averageInferenceDurationMs: 12,
	};
	assert.deepEqual(
		Schema.decodeUnknownSync(PosePerformanceMetrics)(snapshot),
		snapshot,
	);
	assert.equal(
		Schema.decodeUnknownSync(PosePerformanceMetrics)({
			...snapshot,
			averageInferenceDurationMs: null,
		}).averageInferenceDurationMs,
		null,
	);
	assert.throws(() =>
		Schema.decodeUnknownSync(PosePerformanceMetrics)({
			...snapshot,
			intervalMs: 0,
		}),
	);
	assert.throws(() =>
		Schema.decodeUnknownSync(PosePerformanceMetrics)({
			...snapshot,
			inferenceFps: NaN,
		}),
	);
});
