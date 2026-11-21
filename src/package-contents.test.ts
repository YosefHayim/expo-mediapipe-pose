import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	cpSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const FULL_MODEL_SHA256 =
	"5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1";
const LITE_MODEL_SHA256 =
	"59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a";
const HEAVY_MODEL_SHA256 =
	"64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b";

const repositoryRoot = process.cwd();
const cacheRoot = join(repositoryRoot, "node_modules", ".cache");
const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
	name: string;
	exports: Record<string, { default: string; types: string } | string>;
	dependencies?: Record<string, string>;
};

interface NpmPackListing {
	name?: string;
	files: { path: string }[];
}

const consumerCheckSource = `import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { LANDMARK_NAMES } from "./node_modules/expo-mediapipe-pose/build/landmarks/landmark-names.js";
import { pointInImage } from "./node_modules/expo-mediapipe-pose/build/landmarks/pose-frame.js";
const require = createRequire(import.meta.url);
const names = require("./node_modules/expo-mediapipe-pose/build/landmarks/landmark-names.js");
assert.equal(names.LANDMARK_NAMES.length, LANDMARK_NAMES.length);
assert.equal(LANDMARK_NAMES.length, 33);
assert.deepEqual(
  pointInImage({ x: 0.5, y: 0.25, z: 0, visibility: 1, presence: 1 }, 200, 100),
  { x: 100, y: 25 }
);
assert.equal(
  Object.keys(require.cache).some((filePath) => filePath.includes("/react-native/")),
  false
);
`;

function packedPackageContentsTests() {
	test(
		"holds the declarations, native sources, models and plugin",
		holdsRequiredFiles,
	);
	test("ships no generated or example files", shipsNoExampleFiles);
	test(
		"ships the three pose models with recorded checksums",
		shipsModelChecksums,
	);
	test("does not depend on zod", doesNotDependOnZod);
	test(
		"imports named landmarks in Node without React Native",
		importsNamedLandmarks,
	);
}

describe("packed package contents", packedPackageContentsTests);

let packedFiles: string[] = [];
let consumerDirectory = "";

beforeAll(() => {
	packedFiles = listPackedFiles();
	mkdirSync(cacheRoot, { recursive: true });
	consumerDirectory = mkdtempSync(join(cacheRoot, "package-contents-"));
});

afterAll(() => {
	const isConsumerCreated = consumerDirectory !== "";

	if (isConsumerCreated)
		rmSync(consumerDirectory, { recursive: true, force: true });
});

function holdsRequiredFiles() {
	const requiredFiles = [
		"README.md",
		"expo-module.config.json",
		"ExpoMediaPipePose.podspec",
		"app.plugin.js",
		"plugin/build/set-ios-camera-usage-text.js",
		"android/build.gradle",
		"android/src/main/AndroidManifest.xml",
		"assets/pose_landmarker_lite.task",
		"assets/pose_landmarker_full.task",
		"assets/pose_landmarker_heavy.task",
		...listNativeSourceFiles(),
		...listExportedFiles(),
	];
	const missingFiles = requiredFiles.filter(isFileMissing);

	expect(missingFiles).toEqual([]);
	expect(manifest.exports["./core"]).toBeUndefined();
}

function shipsNoExampleFiles() {
	const unexpectedFiles = packedFiles.filter(isUnexpectedPackPath);

	expect(unexpectedFiles).toEqual([]);
}

function shipsModelChecksums() {
	expect(sha256("assets/pose_landmarker_full.task")).toBe(FULL_MODEL_SHA256);
	expect(sha256("assets/pose_landmarker_lite.task")).toBe(LITE_MODEL_SHA256);
	expect(sha256("assets/pose_landmarker_heavy.task")).toBe(HEAVY_MODEL_SHA256);
}

function doesNotDependOnZod() {
	expect(manifest.dependencies?.["zod"]).toBeUndefined();

	const textFiles = packedFiles.filter(isLibraryText);
	const zodFiles = textFiles.filter(importsZod);

	expect(zodFiles).toEqual([]);
}

function importsNamedLandmarks() {
	const modulesDirectory = join(consumerDirectory, "node_modules");
	const packageDirectory = join(modulesDirectory, manifest.name);

	for (const file of packedFiles) {
		const destination = join(packageDirectory, file);
		mkdirSync(dirname(destination), { recursive: true });
		cpSync(join(repositoryRoot, file), destination);
	}

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
}

function listPackedFiles(): string[] {
	const reply = spawnSync("npm pack --dry-run --json --ignore-scripts", {
		cwd: repositoryRoot,
		encoding: "utf8",
		shell: true,
		maxBuffer: 20 * 1024 * 1024,
	});
	const isPackFailed = reply.status !== 0;

	if (isPackFailed) throw new Error(`npm pack failed: ${reply.stderr}`);

	const packedReport: unknown = JSON.parse(reply.stdout);
	const packedList = readPackedFileList(packedReport);
	const isListMissing = packedList == null;

	if (isListMissing) throw new Error("npm pack must report this package");

	return packedList.files.map(readPackedPath);
}

function readPackedFileList(packedReport: unknown): NpmPackListing | null {
	const isNpm11List = Array.isArray(packedReport);

	if (isNpm11List) {
		const namedPackage = packedReport.find(isThisPackage) ?? null;
		return namedPackage as NpmPackListing | null;
	}

	const isMissing = packedReport == null;

	if (isMissing) return null;

	const isRecord = typeof packedReport === "object";

	if (!isRecord) return null;

	const namedPackage = (packedReport as Record<string, NpmPackListing>)[
		manifest.name
	];
	return namedPackage ?? null;
}

function isThisPackage(packageReport: { name?: string }) {
	return packageReport.name === manifest.name;
}

function readPackedPath(file: { path: string }) {
	return file.path;
}

function listNativeSourceFiles(): string[] {
	const swiftFiles = readdirSync("ios")
		.filter(isPublishedSwift)
		.map(toSwiftPath);
	const kotlinFiles = readdirSync("android/src/main", {
		recursive: true,
		encoding: "utf8",
	})
		.filter(isKotlin)
		.map(toKotlinPath);
	return [...swiftFiles, ...kotlinFiles];
}

function isPublishedSwift(name: string) {
	const isSwift = name.endsWith(".swift");

	if (!isSwift) return false;

	const isTest = name.endsWith("Tests.swift");

	if (isTest) return false;

	return true;
}

function toSwiftPath(name: string) {
	return `ios/${name}`;
}

function isKotlin(name: string) {
	return name.endsWith(".kt");
}

function toKotlinPath(name: string) {
	return `android/src/main/${name}`;
}

function listExportedFiles(): string[] {
	const exportedFiles: string[] = [];

	for (const definition of Object.values(manifest.exports)) {
		const isStringPath = typeof definition === "string";

		if (isStringPath) {
			exportedFiles.push(definition.replace(/^\.\//, ""));
			continue;
		}

		exportedFiles.push(definition.default.replace(/^\.\//, ""));
		exportedFiles.push(definition.types.replace(/^\.\//, ""));
	}

	return exportedFiles;
}

function isFileMissing(file: string) {
	return !packedFiles.includes(file);
}

function isUnexpectedPackPath(file: string) {
	return /(^|\/)(node_modules|\.gradle|scripts|example|skills|hello-world)\//.test(
		file,
	);
}

function isLibraryText(file: string) {
	const isBuild = file.startsWith("build/");

	if (isBuild) return true;

	const isSource = file.startsWith("src/");

	if (isSource) return true;

	return false;
}

function importsZod(file: string) {
	return /from "zod"|require\("zod"\)/.test(readFileSync(file, "latin1"));
}

function sha256(file: string) {
	return createHash("sha256").update(readFileSync(file)).digest("hex");
}
