import { Directory, File, Paths } from "expo-file-system";
import {
	analyzePoseImage,
	analyzePoseVideo,
	type PoseDetection,
	type PoseSegmentation,
	releasePoseSegmentation,
} from "expo-mediapipe-pose";

function verify(condition: boolean, message: string): asserts condition {
	if (!condition) throw new Error(message);
}
function available(detection: PoseDetection) {
	const segmentation = detection.segmentation;
	verify(
		segmentation?.status === "available",
		"Segmentation must return a mask lease",
	);
	return segmentation;
}
function inspectMask(
	segmentation: Extract<PoseSegmentation, { status: "available" }>,
	name: string,
) {
	const mask = segmentation.masks[0];
	verify(mask !== undefined, "First mask must exist");
	verify(
		Math.max(mask.width, mask.height) <= 256,
		"Mask dimensions must be bounded",
	);
	const source = new File(mask.uri);
	const png = source.bytesSync();
	verify(
		png[0] === 137 && png[1] === 80 && png[2] === 78 && png[3] === 71,
		"Mask must be a PNG",
	);
	const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
	verify(
		header.getUint32(16) === mask.width && header.getUint32(20) === mask.height,
		"PNG dimensions must match metadata",
	);
	verify(png[24] === 8 && png[25] === 6, "Mask PNG must use RGBA8");
	const artifact = new File(Paths.document, name);
	if (artifact.exists) artifact.delete();
	source.copy(artifact);
	return source;
}
function maskFiles() {
	const folders = Paths.cache
		.list()
		.filter(
			(entry) =>
				entry.name.startsWith("expo-mediapipe-pose-masks-") &&
				entry instanceof Directory,
		);
	return folders.flatMap((folder) =>
		folder instanceof Directory ? folder.list() : [],
	).length;
}
export async function runSegmentationChecks(
	photo: string,
	rotated: string,
	empty: string,
	multiple: string,
	video: string,
	cases: string[],
) {
	const orphan = new Directory(
		Paths.cache,
		"expo-mediapipe-pose-masks-orphan-fixture",
	);
	orphan.create({ idempotent: true });
	new File(orphan, "interrupted.txt").write("interrupted earlier process");
	const beforeDisabled = maskFiles();
	const disabled = await analyzePoseImage(photo);
	verify(
		disabled.segmentation === undefined,
		"Segmentation must be disabled by default",
	);
	verify(
		maskFiles() === beforeDisabled,
		"Disabled mode must not write mask files",
	);
	cases.push("segmentation disabled without mask output");
	const first = available(
		await analyzePoseImage(photo, { segmentationEnabled: true }),
	);
	const firstFile = inspectMask(first, "mask-upright.png");
	verify(!orphan.exists, "First mask output must clear previous-process files");
	cases.push("previous-process mask cleanup");
	const second = available(
		await analyzePoseImage(rotated, { segmentationEnabled: true }),
	);
	const secondFile = inspectMask(second, "mask-rotated.png");
	verify(
		first.imageSize.width === second.imageSize.width &&
			first.imageSize.height === second.imageSize.height,
		"Mask image orientation must be upright",
	);
	cases.push("bounded RGBA masks and orientation metadata");
	const blocked = await analyzePoseImage(photo, { segmentationEnabled: true });
	verify(
		blocked.segmentation?.status === "backpressure",
		"Two outstanding leases must apply backpressure",
	);
	verify(
		firstFile.exists && secondFile.exists,
		"Backpressure must preserve leased masks",
	);
	await releasePoseSegmentation(first.leaseId);
	await releasePoseSegmentation(first.leaseId);
	verify(
		!firstFile.exists && secondFile.exists,
		"Release is idempotent and only deletes its own lease",
	);
	cases.push("mask backpressure and explicit isolated cleanup");
	const people = available(
		await analyzePoseImage(multiple, {
			maxPoses: 2,
			segmentationEnabled: true,
			maskMaxDimension: 64,
		}),
	);
	verify(people.masks.length === 2, "Each detected person must have a mask");
	verify(
		people.masks.every((mask) => Math.max(mask.width, mask.height) <= 64),
		"Custom mask dimension must apply to every pose",
	);
	await releasePoseSegmentation(people.leaseId);
	await releasePoseSegmentation(second.leaseId);
	verify(!secondFile.exists, "Second lease must be removed");
	cases.push("multiple masks and custom bounds");
	const noPerson = await analyzePoseImage(empty, { segmentationEnabled: true });
	verify(
		noPerson.segmentation?.status === "empty",
		"No pose must report empty segmentation",
	);
	for await (const sample of analyzePoseVideo(video, {
		segmentationEnabled: true,
	})) {
		const masks = available(sample.detection);
		await releasePoseSegmentation(masks.leaseId);
		break;
	}
	verify(maskFiles() === 0, "Fixture must release every mask lease");
	cases.push("empty segmentation and video mask cleanup");
}
