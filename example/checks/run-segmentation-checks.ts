import { Directory, File, Paths } from "expo-file-system";
import {
	analyzePoseImage,
	analyzePoseVideo,
	type PoseDetection,
	type PoseSegmentation,
	releasePoseSegmentation,
} from "expo-mediapipe-pose";

const verify: (condition: boolean, message: string) => asserts condition = (
	condition,
	message,
) => {
	const isCheckFailed = !condition;
	if (isCheckFailed) throw new Error(message);
};
const readAvailableSegmentation = (detection: PoseDetection) => {
	const segmentation = detection.segmentation;
	verify(
		segmentation?.status === "available",
		"Segmentation must return a mask lease",
	);
	return segmentation;
};
const inspectMask = (
	segmentation: Extract<PoseSegmentation, { status: "available" }>,
	name: string,
) => {
	const mask = segmentation.masks[0];
	verify(mask != null, "First mask must exist");
	verify(
		Math.max(mask.width, mask.height) <= 256,
		"Mask dimensions must be bounded",
	);
	const maskFile = new File(mask.uri);
	const png = maskFile.bytesSync();
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

	maskFile.copy(artifact);
	return maskFile;
};
const maskFiles = () => {
	const folders = Paths.cache
		.list()
		.filter(
			(file) =>
				file.name.startsWith("expo-mediapipe-pose-masks-") &&
				file instanceof Directory,
		);
	return folders.flatMap((folder) => {
		const isFolderInstanceDirectory = folder instanceof Directory;
		return isFolderInstanceDirectory ? folder.list() : [];
	}).length;
};
export interface RunSegmentationChecksDetails {
	photo: string;
	rotated: string;
	empty: string;
	multiple: string;
	video: string;
	cases: string[];
}

export const runSegmentationChecks = async ({
	photo,
	rotated,
	empty,
	multiple,
	video,
	cases,
}: RunSegmentationChecksDetails) => {
	const leases = new Set<string>();
	const failures: unknown[] = [];
	const trackSegmentation = (detection: PoseDetection) => {
		const segmentation = readAvailableSegmentation(detection);
		leases.add(segmentation.leaseId);
		return segmentation;
	};
	try {
		const orphan = new Directory(
			Paths.cache,
			"expo-mediapipe-pose-masks-orphan-fixture",
		);
		orphan.create({ idempotent: true });
		new File(orphan, "interrupted.txt").write("interrupted earlier process");
		const beforeDisabled = maskFiles();
		const disabled = await analyzePoseImage(photo);
		verify(
			disabled.segmentation == null,
			"Segmentation must be disabled by default",
		);
		verify(
			maskFiles() === beforeDisabled,
			"Disabled mode must not write mask files",
		);
		cases.push("segmentation disabled without mask output");
		const noPerson = await analyzePoseImage(empty, {
			segmentationEnabled: true,
		});
		verify(
			noPerson.segmentation?.status === "empty",
			"No pose must report empty segmentation",
		);
		verify(
			!orphan.exists,
			"First enabled no-pose request must clear previous-process files",
		);
		cases.push("previous-process mask cleanup after an empty detection");
		const first = trackSegmentation(
			await analyzePoseImage(photo, { segmentationEnabled: true }),
		);
		const firstFile = inspectMask(first, "mask-upright.png");
		const second = trackSegmentation(
			await analyzePoseImage(rotated, { segmentationEnabled: true }),
		);
		const secondFile = inspectMask(second, "mask-rotated.png");
		verify(
			first.imageSize.width === second.imageSize.width &&
				first.imageSize.height === second.imageSize.height,
			"Mask image orientation must be upright",
		);
		cases.push("bounded RGBA masks and orientation metadata");
		const blocked = await analyzePoseImage(photo, {
			segmentationEnabled: true,
		});
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
		const people = trackSegmentation(
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
		for await (const sample of analyzePoseVideo(video, {
			segmentationEnabled: true,
		})) {
			const masks = trackSegmentation(sample.detection);
			await releasePoseSegmentation(masks.leaseId);
			break;
		}
		verify(maskFiles() === 0, "Fixture must release every mask lease");
		cases.push("empty segmentation and video mask cleanup");
	} catch (error) {
		failures.push(error);
	} finally {
		const cleanup = await Promise.allSettled(
			[...leases].map(releasePoseSegmentation),
		);
		for (const report of cleanup) {
			const isStatusRejected = report.status === "rejected";
			if (isStatusRejected) failures.push(report.reason);
		}
	}

	const hasOneFailure = failures.length === 1;
	if (hasOneFailure) throw failures[0];

	const hasMultipleFailures = failures.length > 1;
	if (hasMultipleFailures)
		throw new AggregateError(failures, "Mask fixture and cleanup failures");
};
