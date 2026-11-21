import { useState } from "react";
import type { CameraFacing, PoseFrame } from "@/landmarks/pose-frame";
import type { PoseDelegate, PoseModel } from "@/pose-settings";
import type {
	SkeletonJointChoice,
	SkeletonRendering,
} from "@/skeleton/skeleton-joints";
import type { PoseFailure } from "./pose-camera-view";
import {
	type CameraPermission,
	requestCameraPermission,
} from "./request-camera-permission";

export interface PoseCameraRequest {
	isCameraRunning?: boolean;
	cameraFacing?: CameraFacing;
	poseModel?: PoseModel;
	poseDelegate?: PoseDelegate;
	maxPoseCount?: number;
	poseFrameRate?: number;
	minPoseDetectionConfidence?: number;
	minPosePresenceConfidence?: number;
	minTrackingConfidence?: number;
	skeletonRendering?: SkeletonRendering;
	skeletonColor?: string;
	skeletonJoints?: readonly SkeletonJointChoice[];
}

export interface PoseCamera {
	permission: "unknown" | CameraPermission;
	frame: PoseFrame | null;
	failure: PoseFailure | null;
	askForCamera: () => Promise<void>;
	readFrame: (poseFrame: PoseFrame) => void;
	readFailure: (failure: PoseFailure) => void;
	isCameraRunning: boolean;
	cameraFacing: CameraFacing;
	poseModel: PoseModel;
	poseDelegate: PoseDelegate;
	maxPoseCount: number;
	poseFrameRate: number;
	minPoseDetectionConfidence: number;
	minPosePresenceConfidence: number;
	minTrackingConfidence: number;
	skeletonRendering: SkeletonRendering;
	skeletonColor: string;
	skeletonJoints: readonly SkeletonJointChoice[];
}

export function usePoseCamera(poseCamera: PoseCameraRequest = {}): PoseCamera {
	const choices = readPoseCameraChoices(poseCamera);
	const [permission, setPermission] =
		useState<PoseCamera["permission"]>("unknown");
	const [frame, setFrame] = useState<PoseFrame | null>(null);
	const [failure, setFailure] = useState<PoseFailure | null>(null);

	async function askForCamera() {
		try {
			const nextPermission = await requestCameraPermission();

			setPermission(nextPermission);
			setFailure(null);
		} catch (error) {
			setFailure({ reason: "cameraPermission" });
			console.error({ error });
		}
	}

	function readFrame(nextFrame: PoseFrame) {
		setFrame(nextFrame);
		setFailure(null);
	}

	function readFailure(nextFailure: PoseFailure) {
		setFailure(nextFailure);
	}

	return {
		permission,
		frame,
		failure,
		askForCamera,
		readFrame,
		readFailure,
		isCameraRunning: choices.isCameraRunning,
		cameraFacing: choices.cameraFacing,
		poseModel: choices.poseModel,
		poseDelegate: choices.poseDelegate,
		maxPoseCount: choices.maxPoseCount,
		poseFrameRate: choices.poseFrameRate,
		minPoseDetectionConfidence: choices.minPoseDetectionConfidence,
		minPosePresenceConfidence: choices.minPosePresenceConfidence,
		minTrackingConfidence: choices.minTrackingConfidence,
		skeletonRendering: choices.skeletonRendering,
		skeletonColor: choices.skeletonColor,
		skeletonJoints: choices.skeletonJoints,
	};
}

function readPoseCameraChoices(poseCamera: PoseCameraRequest) {
	return {
		isCameraRunning: poseCamera.isCameraRunning ?? true,
		cameraFacing: poseCamera.cameraFacing ?? "front",
		poseModel: poseCamera.poseModel ?? "full",
		poseDelegate: poseCamera.poseDelegate ?? "gpu",
		maxPoseCount: poseCamera.maxPoseCount ?? 1,
		poseFrameRate: poseCamera.poseFrameRate ?? 30,
		minPoseDetectionConfidence: poseCamera.minPoseDetectionConfidence ?? 0.5,
		minPosePresenceConfidence: poseCamera.minPosePresenceConfidence ?? 0.5,
		minTrackingConfidence: poseCamera.minTrackingConfidence ?? 0.5,
		skeletonRendering: poseCamera.skeletonRendering ?? "shown",
		skeletonColor: poseCamera.skeletonColor ?? "#38bdf8",
		skeletonJoints: poseCamera.skeletonJoints ?? [],
	};
}
