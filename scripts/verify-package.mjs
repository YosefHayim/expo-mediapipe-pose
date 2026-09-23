import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
} from "node:fs";
import { join } from "node:path";

const artifactRoot = "scripts/dev";
mkdirSync(artifactRoot, { recursive: true });
const packageDirectory = mkdtempSync(join(artifactRoot, "package-"));
try {
	execFileSync("pnpm", ["pack", "--pack-destination", packageDirectory], {
		stdio: "pipe",
	});
	const tarball = readdirSync(packageDirectory).find((name) =>
		name.endsWith(".tgz"),
	);
	assert.ok(tarball, "pnpm pack must produce a tarball");
	const archive = join(packageDirectory, tarball);
	const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
		.trim()
		.split("\n");
	const manifest = JSON.parse(readFileSync("package.json", "utf8"));
	const requiredFiles = [
		"README.md",
		"docs/api.md",
		"LICENSE",
		"THIRD_PARTY_NOTICES.md",
		"expo-module.config.json",
		"ExpoMediaPipePose.podspec",
		"ios/ExpoMediaPipePoseModule.swift",
		"ios/ExpoMediaPipePoseView.swift",
		"ios/PoseCameraOptions.swift",
		"ios/PoseFrameTiming.swift",
		"android/build.gradle",
		"android/src/main/AndroidManifest.xml",
		"android/src/main/java/expo/modules/mediapipepose/ExpoMediaPipePoseModule.kt",
		"android/src/main/java/expo/modules/mediapipepose/ExpoMediaPipePoseView.kt",
		"android/src/main/java/expo/modules/mediapipepose/PoseCameraOptions.kt",
		"android/src/main/java/expo/modules/mediapipepose/PoseFrameTiming.kt",
		"assets/pose_landmarker_full.task",
	];
	for (const definition of Object.values(manifest.exports)) {
		if (typeof definition === "string") {
			requiredFiles.push(definition.replace(/^\.\//, ""));
			continue;
		}
		requiredFiles.push(definition.default.replace(/^\.\//, ""));
	}
	for (const file of requiredFiles)
		assert.ok(
			entries.includes(`package/${file}`),
			`Missing package file: ${file}`,
		);
	const unexpectedFiles = entries.filter((entry) =>
		/\/(node_modules|build|\.gradle|scripts|example)\//.test(entry),
	);
	assert.deepEqual(unexpectedFiles, [], "Generated files must not ship");
	const model = execFileSync(
		"tar",
		["-xOf", archive, "package/assets/pose_landmarker_full.task"],
		{ maxBuffer: 20 * 1024 * 1024 },
	);
	assert.equal(
		createHash("sha256").update(model).digest("hex"),
		"5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1",
	);
	console.log(
		`Verified ${entries.length} packaged files, native sources, exports, and model checksum.`,
	);
} finally {
	rmSync(packageDirectory, { recursive: true, force: true });
}
