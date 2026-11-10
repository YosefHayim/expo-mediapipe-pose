import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { BrowserMask, WorkerReply, WorkerRequest } from "@/types";

let detector: PoseLandmarker | null = null;
let generation = 0;
let runningMode: "IMAGE" | "VIDEO" = "IMAGE";
let maskMaxDimension = 256;
const send = (message: WorkerReply) => postMessage(message);
const answerWorkerRequest = async (message: WorkerRequest) => {
	const isMessageTypeClose = message.type === "close";
	if (isMessageTypeClose) {
		detector?.close();
		detector = null;
		return;
	}

	const isMessageTypeInit = message.type === "init";
	if (isMessageTypeInit) {
		detector?.close();
		detector = null;
		generation = message.generation;
		maskMaxDimension = message.detection.maskMaxDimension;
		const { detection: settings } = message;
		const vision = await FilesetResolver.forVisionTasks(
			`${message.base}wasm`,
			true,
		);
		detector = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: message.model
				? { modelAssetBuffer: new Uint8Array(message.model), delegate: "CPU" }
				: {
						modelAssetPath: `${message.base}pose_landmarker_full.task`,
						delegate: "CPU",
					},
			runningMode: "IMAGE",
			numPoses: settings.maxPoses,
			minPoseDetectionConfidence: settings.minPoseDetectionConfidence,
			minPosePresenceConfidence: settings.minPosePresenceConfidence,
			minTrackingConfidence: settings.minTrackingConfidence,
			outputSegmentationMasks: settings.segmentationEnabled,
		});
		runningMode = "IMAGE";
		send({ type: "ready", generation });
		return;
	}

	const { image } = message;
	try {
		const loadedDetector = detector;

		const isDetectorUnusable =
			loadedDetector == null || message.generation !== generation;
		if (isDetectorUnusable) return;

		const isVideoMessage = message.video === true;
		const mode = isVideoMessage ? "VIDEO" : "IMAGE";

		const isRunningModeChanged = mode !== runningMode;
		if (isRunningModeChanged) {
			await loadedDetector.setOptions({ runningMode: mode });
			runningMode = mode;
		}

		const start = performance.now();
		const report = message.video
			? loadedDetector.detectForVideo(image, message.timestamp)
			: loadedDetector.detect(image);
		try {
			const duration = performance.now() - start;
			const poses = report.landmarks.map((landmarks, index) => ({
				landmarks,
				worldLandmarks: report.worldLandmarks[index] ?? [],
			}));
			const masks: BrowserMask[] = (report.segmentationMasks ?? []).map(
				(mask) => {
					const scale = Math.min(
						1,
						maskMaxDimension / Math.max(mask.width, mask.height),
					);
					const width = Math.max(1, Math.round(mask.width * scale));
					const height = Math.max(1, Math.round(mask.height * scale));
					const maskFloats = mask.getAsFloat32Array();
					const maskBytes = new Uint8Array(width * height);
					for (let y = 0; y < height; y++)
						for (let horizontal = 0; horizontal < width; horizontal++) {
							const originHorizontal = Math.min(
								mask.width - 1,
								Math.floor(((horizontal + 0.5) * mask.width) / width),
							);
							const originY = Math.min(
								mask.height - 1,
								Math.floor(((y + 0.5) * mask.height) / height),
							);
							maskBytes[y * width + horizontal] = Math.round(
								(maskFloats[originY * mask.width + originHorizontal] ?? 0) *
									255,
							);
						}
					return { width, height, values: maskBytes };
				},
			);
			send({
				type: "result",
				generation,
				masks,
				frame: {
					poses,
					landmarks: poses[0]?.landmarks ?? [],
					worldLandmarks: poses[0]?.worldLandmarks ?? [],
					imageSize: { width: image.width, height: image.height },
					inferenceDurationMs: duration,
				},
			});
		} finally {
			report.close();
		}
	} finally {
		image.close();
	}
};
// Serialize model initialization and inference so every detector stays on its owner.
let queue: Promise<void> = Promise.resolve();
const answerQueuedRequest = async (
	previousAnswer: Promise<void>,
	message: WorkerRequest,
) => {
	await previousAnswer;
	try {
		await answerWorkerRequest(message);
	} catch (error) {
		const isErrorInstanceError = error instanceof Error;
		send({
			type: "error",
			generation,
			message: isErrorInstanceError ? error.message : String(error),
		});
	}
};
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	queue = answerQueuedRequest(queue, event.data);
};
