import { useState } from "react";
import type { PoseFrame } from "@/landmarks/pose-frame";
import { type PoseVideoRequest, readPoseVideo } from "./read-pose-file";

export interface PoseVideoRead {
	frames: PoseFrame[];
	shownFrameIndex: number;
	shownFrame: PoseFrame | null;
	failure: string | null;
	read: (video: PoseVideoRequest) => Promise<void>;
	chooseShownFrame: (frameIndex: number) => void;
}

export function usePoseVideo(): PoseVideoRead {
	const [frames, setFrames] = useState<PoseFrame[]>([]);
	const [shownFrameIndex, setShownFrameIndex] = useState(0);
	const [failure, setFailure] = useState<string | null>(null);

	async function read(video: PoseVideoRequest) {
		try {
			const poseFrames = await readPoseVideo(video);

			setFrames(poseFrames);
			setShownFrameIndex(0);
			setFailure(null);
		} catch (error) {
			setFrames([]);
			setShownFrameIndex(0);
			setFailure(readThrownMessage(error));
		}
	}

	function chooseShownFrame(frameIndex: number) {
		const isWhole = Number.isInteger(frameIndex);
		const isFraction = isWhole == false;

		refuseMissingSampleFrame(isFraction);

		const isBeforeStart = frameIndex < 0;

		refuseMissingSampleFrame(isBeforeStart);

		const isPastEnd = frameIndex >= frames.length;

		refuseMissingSampleFrame(isPastEnd);

		setShownFrameIndex(frameIndex);
	}

	const shownFrame = frames[shownFrameIndex] ?? null;

	return {
		frames,
		shownFrameIndex,
		shownFrame,
		failure,
		read,
		chooseShownFrame,
	};
}

function refuseMissingSampleFrame(isOutside: boolean) {
	if (isOutside) throw new Error("That video frame is not in the sample.");
}

function readThrownMessage(error: unknown): string {
	const isError = error instanceof Error;

	if (isError) return error.message;

	throw error;
}
