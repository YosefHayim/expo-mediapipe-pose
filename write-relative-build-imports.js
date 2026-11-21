const { readdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join, relative, sep } = require("node:path");

const buildDirectory = "build";

// tsc leaves path aliases in the emitted files. Published code has to use relative imports.
function listEmittedFiles(directory) {
	const emittedFiles = [];

	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = join(directory, entry.name);
		const isDirectory = entry.isDirectory();

		if (isDirectory) {
			const nestedFiles = listEmittedFiles(entryPath);
			emittedFiles.push(...nestedFiles);
			continue;
		}

		const isDeclaration = entry.name.endsWith(".d.ts");

		if (isDeclaration) {
			emittedFiles.push(entryPath);
			continue;
		}

		const isJavaScript = entry.name.endsWith(".js");

		if (isJavaScript) {
			emittedFiles.push(entryPath);
		}
	}

	return emittedFiles;
}

function readRelativeSpecifier(filePath, specifier) {
	const isAlias = specifier.startsWith("@/");

	if (!isAlias) {
		return specifier;
	}

	const insideLibrary = specifier.slice(2);
	const targetPath = join(buildDirectory, insideLibrary);
	const fromDirectory = dirname(filePath);
	const relativeTarget = relative(fromDirectory, targetPath);
	const portableTarget = relativeTarget.split(sep).join("/");
	const isAlreadyRelative = portableTarget.startsWith(".");

	if (isAlreadyRelative) {
		return portableTarget;
	}

	return `./${portableTarget}`;
}

function rewriteAliasSpecifiers(fileBody, filePath) {
	const marker = '"@/';
	let cursor = 0;
	let rewrittenBody = "";

	while (cursor < fileBody.length) {
		const start = fileBody.indexOf(marker, cursor);
		const isMissing = start == -1;

		if (isMissing) {
			rewrittenBody += fileBody.slice(cursor);
			return rewrittenBody;
		}

		const specifierStart = start + 1;
		const specifierEnd = fileBody.indexOf('"', specifierStart);
		const specifier = fileBody.slice(specifierStart, specifierEnd);
		const relativeSpecifier = readRelativeSpecifier(filePath, specifier);

		rewrittenBody += fileBody.slice(cursor, specifierStart);
		rewrittenBody += relativeSpecifier;
		cursor = specifierEnd;
	}

	return rewrittenBody;
}

function writeRelativeBuildImports() {
	const emittedFiles = listEmittedFiles(buildDirectory);

	for (const filePath of emittedFiles) {
		const fileBody = readFileSync(filePath, "utf8");
		const rewrittenBody = rewriteAliasSpecifiers(fileBody, filePath);
		const isUnchanged = rewrittenBody == fileBody;

		if (isUnchanged) {
			continue;
		}

		writeFileSync(filePath, rewrittenBody);
	}
}

writeRelativeBuildImports();
