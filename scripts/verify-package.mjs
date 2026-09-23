import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
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
		"docs/guides/expo-pose-detection.md",
		"docs/guides/custom-skeleton-styling.md",
		"docs/guides/angle-triggered-feedback.md",
		"llms.txt",
		"CHANGELOG.md",
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
		requiredFiles.push(definition.types.replace(/^\.\//, ""));
	}
	for (const file of requiredFiles)
		assert.ok(
			entries.includes(`package/${file}`),
			`Missing package file: ${file}`,
		);
	const unexpectedFiles = entries.filter((entry) =>
		/\/(node_modules|\.gradle|scripts|example)\//.test(entry),
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
	const consumerDirectory = join(packageDirectory, "consumer");
	const modulesDirectory = join(consumerDirectory, "node_modules");
	mkdirSync(modulesDirectory, { recursive: true });
	writeFileSync(
		join(consumerDirectory, "package.json"),
		JSON.stringify({
			name: "pose-package-verification",
			private: true,
			dependencies: { effect: manifest.peerDependencies.effect },
		}),
	);
	execFileSync("pnpm", ["install", "--ignore-workspace", "--ignore-scripts"], {
		cwd: consumerDirectory,
		stdio: "pipe",
	});
	execFileSync("tar", ["-xzf", archive, "-C", modulesDirectory]);
	renameSync(
		join(modulesDirectory, "package"),
		join(modulesDirectory, manifest.name),
	);
	writeFileSync(
		join(consumerDirectory, "check.mjs"),
		`import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import * as esmCore from "expo-mediapipe-pose/core";
import { LANDMARK_NAMES, getImageJointAngle } from "expo-mediapipe-pose/core";
const require = createRequire(import.meta.url);
const core = require("expo-mediapipe-pose/core");
for (const name of Object.keys(core)) assert.equal(esmCore[name], core[name], name);
assert.equal(core.LANDMARK_NAMES.length, 33);
const landmarks = LANDMARK_NAMES.map(() => ({ x: 0, y: 0, z: 0, visibility: 1 }));
landmarks[11] = { x: 0, y: 1, z: 0, visibility: 1 };
landmarks[15] = { x: 1, y: 0, z: 0, visibility: 1 };
assert.deepEqual(getImageJointAngle(
  { landmarks, imageSize: { width: 640, height: 480 } },
  "leftShoulder", "leftElbow", "leftWrist"
), { status: "available", value: 90, unit: "degrees" });
assert.equal(Object.keys(require.cache).some(path => path.includes("/react-native/")), false);
const consumerModules = fileURLToPath(new URL("./node_modules/", import.meta.url));
for (const path of Object.keys(require.cache)) {
  assert.ok(path.startsWith(consumerModules), "Dependency escaped packed consumer: " + path);
}
`,
	);
	execFileSync(process.execPath, [join(consumerDirectory, "check.mjs")], {
		stdio: "pipe",
	});
	console.log(
		`Verified ${entries.length} packaged files, declarations, native sources, model checksum, and Node ESM/CommonJS core imports.`,
	);
} finally {
	rmSync(packageDirectory, { recursive: true, force: true });
}
