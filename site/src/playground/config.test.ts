import { describe, expect, test } from "vitest";
import { createDefaultSettings, defaultRule, parseSettings } from "./config";

describe("parseConfig", () => {
	test("keeps defaults and rejects unsupported or executable content", () => {
		const settings = createDefaultSettings();

		expect(parseSettings(JSON.stringify(settings))).toStrictEqual(settings);
		expect(settings.detection.minTrackingConfidence).toBe(0.35);

		expect(() =>
			parseSettings(
				JSON.stringify({
					...settings,
					rules: [{ ...defaultRule, kind: "height", space: "world" }],
				}),
			),
		).toThrow();
		expect(() =>
			parseSettings(JSON.stringify({ ...settings, version: 2 })),
		).toThrow();
		expect(() =>
			parseSettings(
				JSON.stringify({
					...settings,
					rules: [{ ...defaultRule, evaluate: "alert(1)" }],
				}),
			),
		).toThrow();
		expect(() =>
			parseSettings(
				JSON.stringify({
					...settings,
					skeleton: {
						...settings.skeleton,
						joints: { imaginary: { color: "#ffffff", radius: 4 } },
					},
				}),
			),
		).toThrow();
		expect(() =>
			parseSettings(
				JSON.stringify({
					...settings,
					rules: [{ ...defaultRule, enterThreshold: 100 }],
				}),
			),
		).toThrow();
	});
});
