import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";

const isMacOs = process.platform === "darwin";

if (!isMacOs) {
	console.log("Swift frame-timing tests skipped: they run only on macOS.");
	process.exit(0);
}

const testBinaryPath = "scripts/dev/frame-timing-tests";
mkdirSync("scripts/dev", { recursive: true });

const compileReply = spawnSync(
	"xcrun",
	[
		"swiftc",
		"ios/PoseFrameTiming.swift",
		"ios/PoseFrameTimingTests.swift",
		"-o",
		testBinaryPath,
	],
	{ stdio: "inherit" },
);
const isCompileFailed = compileReply.status !== 0;

if (isCompileFailed) {
	process.exit(1);
}

const runReply = spawnSync(testBinaryPath, { stdio: "inherit" });
process.exit(runReply.status ?? 1);
