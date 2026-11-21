import { LANDMARK_NAMES, type LandmarkName } from "@/landmarks/landmark-names";

export type SkeletonRendering = "shown" | "hidden";

export interface SkeletonJointChoice {
	landmarkName: LandmarkName;
	shown?: SkeletonRendering;
	color?: string;
}

export interface SkeletonJointLook {
	shown: SkeletonRendering;
	color: string;
}

export function readSkeletonJointLooks(
	skeletonJoints: readonly SkeletonJointChoice[],
	skeletonColor: string,
): Map<LandmarkName, SkeletonJointLook> {
	const looks = new Map<LandmarkName, SkeletonJointLook>();

	for (const choice of skeletonJoints) {
		const landmarkName = readLandmarkName(choice.landmarkName);
		const isRepeated = looks.has(landmarkName);

		if (isRepeated) {
			throw new Error(`The skeleton lists ${landmarkName} twice.`);
		}

		const shown = readShown(choice.shown);
		const color = choice.color ?? skeletonColor;

		looks.set(landmarkName, { shown, color });
	}

	return looks;
}

export function readJointLook(
	looks: Map<LandmarkName, SkeletonJointLook>,
	landmarkName: LandmarkName,
	skeletonColor: string,
): SkeletonJointLook {
	const chosen = looks.get(landmarkName);
	const isUnlisted = chosen == null;

	if (isUnlisted) return { shown: "shown", color: skeletonColor };

	return chosen;
}

function readLandmarkName(landmarkName: string): LandmarkName {
	for (const knownName of LANDMARK_NAMES) {
		const isKnown = knownName == landmarkName;

		if (isKnown) return knownName;
	}

	throw new Error(`Unknown landmark "${landmarkName}".`);
}

function readShown(shown: string | undefined): SkeletonRendering {
	const isMissing = shown == null;

	if (isMissing) return "shown";

	const isShown = shown == "shown";

	if (isShown) return "shown";

	const isHidden = shown == "hidden";

	if (isHidden) return "hidden";

	throw new Error('A skeleton joint is "shown" or "hidden".');
}
