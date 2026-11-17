import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const MODEL_SHA256 =
	"5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1";

const repositoryRoot = process.cwd();
const cacheRoot = join(repositoryRoot, "node_modules", ".cache");
const manifest = JSON.parse(readFileSync("package.json", "utf8"));

type PackedFileList = { files: { path: string }[] };

function listPackedFiles(): string[] {
	// The build task runs before this test (turbo "//#test" depends on "//#build"),
	// so listing the files against the existing build/ output cannot race it.
	// --ignore-scripts stops prepack from rebuilding build/ during the test.
	const reply = spawnSync("npm pack --dry-run --json --ignore-scripts", {
		cwd: repositoryRoot,
		encoding: "utf8",
		shell: true,
		maxBuffer: 20 * 1024 * 1024,
	});
	const isPackFailed = reply.status !== 0;
	if (isPackFailed) {
		throw new Error(`npm pack failed: ${reply.stderr}`);
	}
	const packedPackages: Record<string, PackedFileList> = JSON.parse(
		reply.stdout,
	);
	const firstList = packedPackages[manifest.name];
	assert.ok(firstList, "npm pack must report this package");
	return firstList.files.map((file) => file.path);
}

function listNativeSourceFiles(): string[] {
	const swiftFiles = readdirSync("ios")
		.filter((name) => name.endsWith(".swift") && !name.endsWith("Tests.swift"))
		.map((name) => `ios/${name}`);
	const kotlinFiles = readdirSync("android/src/main", { recursive: true })
		.filter((name) => name.endsWith(".kt"))
		.map((name) => `android/src/main/${name}`);
	return [...swiftFiles, ...kotlinFiles];
}

function listExportedFiles(): string[] {
	const exportedFiles: string[] = [];
	for (const definition of Object.values(manifest.exports)) {
		if (typeof definition === "string") {
			exportedFiles.push(definition.replace(/^\.\//, ""));
			continue;
		}
		const { default: runtimeFile, types: declarationFile } = definition as {
			default: string;
			types: string;
		};
		exportedFiles.push(runtimeFile.replace(/^\.\//, ""));
		exportedFiles.push(declarationFile.replace(/^\.\//, ""));
	}
	return exportedFiles;
}

const consumerCheckSource = `import assert from "node:assert/strict";
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
`;

describe("packed package contents", () => {
	let packedFiles: string[] = [];
	let consumerDirectory = "";

	beforeAll(() => {
		packedFiles = listPackedFiles();
		mkdirSync(cacheRoot, { recursive: true });
		consumerDirectory = mkdtempSync(join(cacheRoot, "package-contents-"));
	});

	afterAll(() => {
		const isConsumerCreated = consumerDirectory !== "";
		if (isConsumerCreated) {
			rmSync(consumerDirectory, { recursive: true, force: true });
		}
	});

	test("holds the declarations, native sources, model and notices", () => {
		const requiredFiles = [
			"README.md",
			"llms.txt",
			"CHANGELOG.md",
			"LICENSE",
			"THIRD_PARTY_NOTICES.md",
			"expo-module.config.json",
			"ExpoMediaPipePose.podspec",
			"android/build.gradle",
			"android/src/main/AndroidManifest.xml",
			"assets/pose_landmarker_full.task",
			...listNativeSourceFiles(),
			...listExportedFiles(),
		];
		const missingFiles = requiredFiles.filter(
			(file) => !packedFiles.includes(file),
		);
		expect(missingFiles).toEqual([]);
	});

	test("ships no generated or example files", () => {
		const unexpectedFiles = packedFiles.filter((file) =>
			/(^|\/)(node_modules|\.gradle|scripts|example)\//.test(file),
		);
		expect(unexpectedFiles).toEqual([]);
	});

	test("ships the model with the recorded checksum", () => {
		const model = readFileSync("assets/pose_landmarker_full.task");
		expect(createHash("sha256").update(model).digest("hex")).toBe(MODEL_SHA256);
	});

	test("does not import effect", () => {
		const importsEffect = /from "effect"|require\("effect"\)|@effect\//;
		const textFiles = packedFiles.filter(
			(file) => file.startsWith("build/") || file.startsWith("src/"),
		);
		const offendingFiles = textFiles.filter((file) =>
			importsEffect.test(readFileSync(file, "latin1")),
		);
		expect(offendingFiles).toEqual([]);
	});

	test("imports the pure core in Node as ESM and CommonJS", () => {
		const modulesDirectory = join(consumerDirectory, "node_modules");
		const packageDirectory = join(modulesDirectory, manifest.name);
		for (const file of packedFiles) {
			const destination = join(packageDirectory, file);
			mkdirSync(dirname(destination), { recursive: true });
			cpSync(join(repositoryRoot, file), destination);
		}
		const zodDirectory = realpathSync(
			join(repositoryRoot, "node_modules", "zod"),
		);
		cpSync(zodDirectory, join(modulesDirectory, "zod"), { recursive: true });
		writeFileSync(
			join(consumerDirectory, "package.json"),
			JSON.stringify({ name: "pose-package-verification", private: true }),
		);
		writeFileSync(join(consumerDirectory, "check.mjs"), consumerCheckSource);
		const reply = spawnSync(
			process.execPath,
			[join(consumerDirectory, "check.mjs")],
			{ encoding: "utf8" },
		);
		expect(reply.stderr).toBe("");
		expect(reply.status).toBe(0);
	});
});
