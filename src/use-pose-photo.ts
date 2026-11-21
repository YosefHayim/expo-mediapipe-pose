import { useState } from "react";
import type { PoseFrame } from "./landmarks/pose-frame";
import { type PosePhotoRequest, readPosePhoto } from "./read-pose-file";

export interface PosePhotoRead {
	frame: PoseFrame | null;
	failure: string | null;
	read: (photo: PosePhotoRequest) => Promise<void>;
}

export function usePosePhoto(): PosePhotoRead {
	const [frame, setFrame] = useState<PoseFrame | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	async function read(photo: PosePhotoRequest) {
		try {
			const poseFrame = await readPosePhoto(photo);

			setFrame(poseFrame);
			setFailure(null);
		} catch (error) {
			setFrame(null);
			setFailure(readThrownMessage(error));
		}
	}

	return { frame, failure, read };
}

function readThrownMessage(error: unknown): string {
	const isError = error instanceof Error;

	if (isError) return error.message;

	throw error;
}
