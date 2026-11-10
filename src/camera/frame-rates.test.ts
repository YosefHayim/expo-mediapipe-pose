import { strict as assert } from "node:assert";
import { describe, test } from "vitest";
import {
	getOverlayStaleAfterMs,
	PosePerformanceMetrics,
	validateFrameRates,
} from "../core";

describe("validateFrameRates", () => {
	test("accepts independent rates and rejects invalid public rate settings", () => {
		validateFrameRates({ frameLimit: 15, previewFps: 60, callbackFps: 5 });
		validateFrameRates({ frameLimit: 1, previewFps: 1, callbackFps: 1 });
		validateFrameRates({ frameLimit: 60, previewFps: 60, callbackFps: 60 });

		for (const name of ["frameLimit", "previewFps", "callbackFps"]) {
			for (const frameRate of [0, 61, 1.5, NaN, Infinity]) {
				assert.throws(
					() =>
						validateFrameRates({
							frameLimit: 30,
							previewFps: 30,
							callbackFps: 30,
							[name]: frameRate,
						}),
					RangeError,
				);
			}
		}
	});
});

describe("PosePerformanceMetrics", () => {
	test("decodes measured performance and preserves unavailable average duration", () => {
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

		assert.deepEqual(PosePerformanceMetrics.parse(snapshot), snapshot);
		assert.equal(
			PosePerformanceMetrics.parse({
				...snapshot,
				averageInferenceDurationMs: null,
			}).averageInferenceDurationMs,
			null,
		);
		assert.throws(() =>
			PosePerformanceMetrics.parse({
				...snapshot,
				intervalMs: 0,
			}),
		);
		assert.throws(() =>
			PosePerformanceMetrics.parse({
				...snapshot,
				inferenceFps: NaN,
			}),
		);
	});
});

describe("getOverlayStaleAfterMs", () => {
	test("keeps overlays between expected frames when any stage limits throughput", () => {
		const rates = { frameLimit: 30, previewFps: 30, callbackFps: 30 };

		assert.equal(getOverlayStaleAfterMs(rates), 500);
		for (const name of ["frameLimit", "previewFps", "callbackFps"]) {
			assert.equal(getOverlayStaleAfterMs({ ...rates, [name]: 1 }), 2000);
		}
	});
});
