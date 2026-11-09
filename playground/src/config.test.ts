import { describe, expect, test } from "vitest";
import { defaultRule, defaults, parseConfig } from "./config";

describe("parseConfig", () => {
	test("keeps defaults and rejects unsupported or executable content", () => {
		const config = defaults();

		expect(parseConfig(JSON.stringify(config))).toStrictEqual(config);
		expect(config.detection.minTrackingConfidence).toBe(0.35);

		expect(() =>
			parseConfig(
				JSON.stringify({
					...config,
					rules: [{ ...defaultRule, kind: "height", space: "world" }],
				}),
			),
		).toThrow();
		expect(() =>
			parseConfig(JSON.stringify({ ...config, version: 2 })),
		).toThrow();
		expect(() =>
			parseConfig(
				JSON.stringify({
					...config,
					rules: [{ ...defaultRule, evaluate: "alert(1)" }],
				}),
			),
		).toThrow();
		expect(() =>
			parseConfig(
				JSON.stringify({
					...config,
					skeleton: {
						...config.skeleton,
						joints: { imaginary: { color: "#ffffff", radius: 4 } },
					},
				}),
			),
		).toThrow();
		expect(() =>
			parseConfig(
				JSON.stringify({
					...config,
					rules: [{ ...defaultRule, enterThreshold: 100 }],
				}),
			),
		).toThrow();
	});
});
