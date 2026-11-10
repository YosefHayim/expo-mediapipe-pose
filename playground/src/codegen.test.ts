import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { generateCode } from "./codegen";
import { defaultRule, readPresetSettings } from "./config";

const compileTimeoutMilliseconds = 120000;

describe("generateCode", () => {
	test(
		"every generated integration compiles against the actual native API",
		() => {
			const directory = mkdtempSync(join(process.cwd(), ".generated-code-"));
			try {
				const config = readPresetSettings("arms");
				const configured = {
					...config,
					detection: {
						...config.detection,
						modelVariant: "heavy" as const,
						segmentationEnabled: true,
					},
					rules: [
						defaultRule,
						{
							...defaultRule,
							kind: "distance" as const,
							space: "world" as const,
						},
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
		},
		compileTimeoutMilliseconds,
	);

	test("custom full models and segmentation styles are reflected in exported code", () => {
		const config = readPresetSettings("mask");

		const code = generateCode(config, "camera", true);

		expect(code).toMatch(
			/poseModelAssetPath="\/absolute\/path\/to\/your-model.task"/,
		);
		expect(code).toMatch(/PoseSegmentationOverlay segmentation=/);
		expect(code).toMatch(/color="#22c55e" opacity=\{0.5\}/);
		expect(code).toMatch(/useLayoutEffect/);
	});
});
