import { Asset } from "expo-asset";
import { File, Paths } from "expo-file-system";
import { analyzePoseImage, getCameraCapabilities } from "expo-mediapipe-pose";
import { Platform } from "react-native";
import { runMultiplePoseChecks } from "./runMultiplePoseChecks";
import { runSegmentationChecks } from "./runSegmentationChecks";
import { runVideoChecks } from "./runVideoChecks";

function verify(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
async function localAsset(module: number) {
	const asset = await Asset.fromModule(module).downloadAsync();
	verify(asset.localUri !== null, "Fixture must be downloaded before analysis");
	return asset.localUri;
}
export async function runNativeChecks() {
	const cases: string[] = [];
	const nativeFailures: { label: string; code: string; message: string }[] = [];
	async function expectNativeFailure(
		label: string,
		operation: () => Promise<unknown>,
		expectedMessage?: string,
	) {
		try {
			await operation();
		} catch (error) {
			verify(
				typeof error === "object" && error !== null,
				`${label}: expected native error`,
			);
			verify(
				"code" in error && typeof error.code === "string",
				`${label}: expected native error code`,
			);
			const message = String(error);
			if (expectedMessage)
				verify(
					message.includes(expectedMessage),
					`${label}: unexpected error: ${message}`,
				);
			nativeFailures.push({ label, code: error.code, message });
			return;
		}
		throw new Error(`${label}: expected rejection`);
	}
	writeReport({ status: "running", platform: Platform.OS, cases });
	try {
		const capabilities = await getCameraCapabilities();
		cases.push(`camera discovery: ${capabilities.status}`);
		const photo = await localAsset(require("./fixtures/pose.jpg"));
		const result = await analyzePoseImage(photo);
		verify(
			result.landmarks.length === 33,
			"Pose image must produce 33 image landmarks",
		);
		verify(
			result.worldLandmarks.length === 33,
			"Pose image must produce 33 world landmarks",
		);
		verify(result.model.delegate === "CPU", "Photo analysis uses CPU");
		verify(
			!("additionalData" in result),
			"Photo results must not invent camera metadata",
		);
		cases.push("real pose image and world landmarks");
		for (const location of [
			photo.replace(/^file:/, "FILE:"),
			photo.replace(/^file:\/\//, "file://LOCALHOST"),
		]) {
			const cased = await analyzePoseImage(location);
			verify(
				cased.landmarks.length === 33,
				"Local URI scheme and host are case insensitive",
			);
		}
		cases.push("case-insensitive local URI scheme and host");
		const orientations = [
			require("./fixtures/pose-exif-2.jpg"),
			require("./fixtures/pose-exif-3.jpg"),
			require("./fixtures/pose-exif-4.jpg"),
			require("./fixtures/pose-exif-5.jpg"),
			require("./fixtures/pose-exif-6.jpg"),
			require("./fixtures/pose-exif-7.jpg"),
			require("./fixtures/pose-exif-8.jpg"),
		];
		for (const [index, module] of orientations.entries()) {
			const oriented = await analyzePoseImage(await localAsset(module));
			verify(
				oriented.imageSize.width === result.imageSize.width,
				"EXIF upright width must match",
			);
			verify(
				oriented.imageSize.height === result.imageSize.height,
				"EXIF upright height must match",
			);
			verify(
				oriented.landmarks.length === 33,
				"EXIF image must produce a pose",
			);
			for (const [jointIndex, landmark] of oriented.landmarks.entries()) {
				const reference = result.landmarks[jointIndex];
				verify(reference !== undefined, "Reference landmark must exist");
				verify(
					Math.abs(landmark.x - reference.x) < 0.05,
					"EXIF x must align with upright reference",
				);
				verify(
					Math.abs(landmark.y - reference.y) < 0.05,
					"EXIF y must align with upright reference",
				);
			}
			cases.push(`EXIF orientation ${index + 2}`);
		}

		const emptyImage = await localAsset(require("./fixtures/burger.jpg"));
		const empty = await analyzePoseImage(emptyImage);
		verify(
			empty.landmarks.length === 0,
			"No-pose image must return empty landmarks",
		);
		cases.push("real no-pose image");
		const bounded = await analyzePoseImage(photo, { maxImageDimension: 256 });
		verify(
			Math.max(bounded.imageSize.width, bounded.imageSize.height) <= 256,
			"Decode must respect maximum dimension",
		);
		cases.push("bounded image decoding");
		const invalid = new File(Paths.cache, "pose-invalid-image.txt");
		invalid.write("not an image");
		try {
			await expectNativeFailure("invalid image", () =>
				analyzePoseImage(invalid.uri),
			);
		} finally {
			invalid.delete();
		}
		cases.push("invalid local image rejected");
		await expectNativeFailure("missing image", () =>
			analyzePoseImage(new File(Paths.cache, "pose-missing-image.jpg").uri),
		);
		cases.push("missing local image rejected");
		await expectNativeFailure("invalid model", () =>
			analyzePoseImage(photo, { modelPath: photo }),
		);
		cases.push("invalid local model rejected");
		const oversized = await localAsset(require("./fixtures/oversized.png"));
		await expectNativeFailure(
			"oversized image",
			() => analyzePoseImage(oversized),
			"16,777,216 pixels",
		);
		cases.push("oversized source rejected before pixel decoding");

		const recovery = await analyzePoseImage(photo);
		verify(
			recovery.landmarks.length === 33,
			"Analysis must recover after invalid input",
		);
		cases.push("resources reusable after failure");
		await runVideoChecks(
			await localAsset(require("./fixtures/pose-video.mp4")),
			await localAsset(require("./fixtures/pose-video-rotated.mp4")),
			result,
			cases,
		);
		await runMultiplePoseChecks(
			await localAsset(require("./fixtures/man-woman-okay.jpg")),
			cases,
		);
		await runSegmentationChecks(
			photo,
			await localAsset(require("./fixtures/pose-exif-6.jpg")),
			emptyImage,
			await localAsset(require("./fixtures/man-woman-okay.jpg")),
			await localAsset(require("./fixtures/pose-video.mp4")),
			cases,
		);
		return writeReport({
			status: "passed",
			platform: Platform.OS,
			cases,
			nativeFailures,
		});
	} catch (error) {
		return writeReport({
			status: "failed",
			platform: Platform.OS,
			cases,
			nativeFailures,
			error:
				error instanceof Error
					? [error.message, error.stack].filter(Boolean).join("\n")
					: String(error),
		});
	}
}
function writeReport(report: {
	status: string;
	platform: string;
	cases: string[];
	nativeFailures?: { label: string; code: string; message: string }[];
	error?: string;
}) {
	new File(Paths.document, "pose-native-checks.json").write(
		JSON.stringify(report),
	);
	return JSON.stringify(report, null, 2);
}
