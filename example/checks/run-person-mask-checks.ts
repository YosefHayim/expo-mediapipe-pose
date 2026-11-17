import { Directory, File, Paths } from "expo-file-system";
import {
	analyzePoseImage,
	analyzePoseVideo,
	type PoseDetection,
	type PosePersonMask,
	releasePosePersonMask,
} from "expo-mediapipe-pose";
import { verifyCheck } from "./verify-check";

const readAvailablePersonMask = (detection: PoseDetection) => {
	const personMask = detection.personMask;
	verifyCheck(
		personMask?.status === "available",
		"Person mask must return a mask lease",
	);
	return personMask;
};
const inspectMask = (
	personMask: Extract<PosePersonMask, { status: "available" }>,
	name: string,
) => {
	const mask = personMask.masks[0];
	verifyCheck(mask != null, "First mask must exist");
	verifyCheck(
		Math.max(mask.width, mask.height) <= 256,
		"Mask dimensions must be bounded",
	);
	const maskFile = new File(mask.uri);
	const png = maskFile.bytesSync();
	verifyCheck(
		png[0] === 137 && png[1] === 80 && png[2] === 78 && png[3] === 71,
		"Mask must be a PNG",
	);
	const header = new DataView(png.buffer, png.byteOffset, png.byteLength);
	verifyCheck(
		header.getUint32(16) === mask.width && header.getUint32(20) === mask.height,
		"PNG dimensions must match metadata",
	);
	verifyCheck(png[24] === 8 && png[25] === 6, "Mask PNG must use RGBA8");

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
export interface RunPersonMaskChecksDetails {
	photo: string;
	rotated: string;
	empty: string;
	multiple: string;
	video: string;
	cases: string[];
}

export const runPersonMaskChecks = async ({
	photo,
	rotated,
	empty,
	multiple,
	video,
	cases,
}: RunPersonMaskChecksDetails) => {
	const leases = new Set<string>();
	const failures: unknown[] = [];
	const trackPersonMask = (detection: PoseDetection) => {
		const personMask = readAvailablePersonMask(detection);
		leases.add(personMask.leaseId);
		return personMask;
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
		verifyCheck(
			disabled.personMask == null,
			"Person mask must be disabled by default",
		);
		verifyCheck(
			maskFiles() === beforeDisabled,
			"Disabled mode must not write mask files",
		);
		cases.push("person mask disabled without mask output");
		const noPerson = await analyzePoseImage(empty, {
			personMaskEnabled: true,
		});
		verifyCheck(
			noPerson.personMask?.status === "empty",
			"No pose must report empty person mask",
		);
		verifyCheck(
			!orphan.exists,
			"First enabled no-pose request must clear previous-process files",
		);
		cases.push("previous-process mask cleanup after an empty detection");
		const first = trackPersonMask(
			await analyzePoseImage(photo, { personMaskEnabled: true }),
		);
		const firstFile = inspectMask(first, "mask-upright.png");
		const second = trackPersonMask(
			await analyzePoseImage(rotated, { personMaskEnabled: true }),
		);
		const secondFile = inspectMask(second, "mask-rotated.png");
		verifyCheck(
			first.imageSize.width === second.imageSize.width &&
				first.imageSize.height === second.imageSize.height,
			"Mask image orientation must be upright",
		);
		cases.push("bounded RGBA masks and orientation metadata");
		const blocked = await analyzePoseImage(photo, {
			personMaskEnabled: true,
		});
		verifyCheck(
			blocked.personMask?.status === "backpressure",
			"Two outstanding leases must apply backpressure",
		);
		verifyCheck(
			firstFile.exists && secondFile.exists,
			"Backpressure must preserve leased masks",
		);
		await releasePosePersonMask(first.leaseId);
		await releasePosePersonMask(first.leaseId);
		verifyCheck(
			!firstFile.exists && secondFile.exists,
			"Release is idempotent and only deletes its own lease",
		);
		cases.push("mask backpressure and explicit isolated cleanup");
		const people = trackPersonMask(
			await analyzePoseImage(multiple, {
				maxPoses: 2,
				personMaskEnabled: true,
				maskMaxDimension: 64,
			}),
		);
		verifyCheck(
			people.masks.length === 2,
			"Each detected person must have a mask",
		);
		verifyCheck(
			people.masks.every((mask) => Math.max(mask.width, mask.height) <= 64),
			"Custom mask dimension must apply to every pose",
		);
		await releasePosePersonMask(people.leaseId);
		await releasePosePersonMask(second.leaseId);
		verifyCheck(!secondFile.exists, "Second lease must be removed");
		cases.push("multiple masks and custom bounds");
		for await (const sample of analyzePoseVideo(video, {
			personMaskEnabled: true,
		})) {
			const masks = trackPersonMask(sample.detection);
			await releasePosePersonMask(masks.leaseId);
			break;
		}
		verifyCheck(maskFiles() === 0, "Fixture must release every mask lease");
		cases.push("empty person mask and video mask cleanup");
	} catch (error) {
		failures.push(error);
	} finally {
		const cleanup = await Promise.allSettled(
			[...leases].map(releasePosePersonMask),
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
