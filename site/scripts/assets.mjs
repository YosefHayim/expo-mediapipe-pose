import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);
const sdk = dirname(require.resolve("@mediapipe/tasks-vision"));
await mkdir("public", { recursive: true });
await cp(resolve(sdk, "wasm"), "public/wasm", { recursive: true });
await cp(
	"../assets/pose_landmarker_full.task",
	"public/pose_landmarker_full.task",
);
for (const file of [
	"pose.jpg",
	"man-woman-okay.jpg",
	"burger.jpg",
	"pose-video.mp4",
]) {
	await cp(`../example/fixtures/${file}`, `public/${file}`);
}
await cp("../THIRD_PARTY_NOTICES.md", "public/THIRD_PARTY_NOTICES.md");
await cp("../LICENSE", "public/LICENSE");
await cp("../llms.txt", "public/llms.txt");
if (existsSync("media")) {
	await cp("media", "public/media", { recursive: true });
}
const skillFile = "../skills/expo-mediapipe-pose/SKILL.md";
if (existsSync(skillFile)) {
	await cp(skillFile, "public/SKILL.md");
}
const { version } = JSON.parse(await readFile("../package.json", "utf8"));
const commit = execFileSync("git", ["rev-parse", "HEAD"], {
	encoding: "utf8",
}).trim();
await writeFile(
	"public/version.json",
	JSON.stringify({ commit, library: version }),
);
