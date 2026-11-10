import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { BrowserMask, WorkerRequest, WorkerResponse } from "@/types";

let detector: PoseLandmarker | undefined;
let generation = 0;
let runningMode: "IMAGE" | "VIDEO" = "IMAGE";
let maskMaxDimension = 256;
const send = (message: WorkerResponse) => postMessage(message);
const answerWorkerRequest = async (message: WorkerRequest) => {
	const isMessageTypeClose = message.type === "close";
	if (isMessageTypeClose) {
		detector?.close();
		detector = undefined;
		return;
	}

	const isMessageTypeInit = message.type === "init";
	if (isMessageTypeInit) {
		detector?.close();
		detector = undefined;
		generation = message.generation;
		maskMaxDimension = message.detection.maskMaxDimension;
		const { detection: options } = message;
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
			numPoses: options.maxPoses,
			minPoseDetectionConfidence: options.minPoseDetectionConfidence,
			minPosePresenceConfidence: options.minPosePresenceConfidence,
			minTrackingConfidence: options.minTrackingConfidence,
			outputSegmentationMasks: options.segmentationEnabled,
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
		const result = message.video
			? loadedDetector.detectForVideo(image, message.timestamp)
			: loadedDetector.detect(image);
		try {
			const duration = performance.now() - start;
			const poses = result.landmarks.map((landmarks, index) => ({
				landmarks,
				worldLandmarks: result.worldLandmarks[index] ?? [],
			}));
			const masks: BrowserMask[] = (result.segmentationMasks ?? []).map(
				(mask) => {
					const scale = Math.min(
						1,
						maskMaxDimension / Math.max(mask.width, mask.height),
					);
					const width = Math.max(1, Math.round(mask.width * scale));
					const height = Math.max(1, Math.round(mask.height * scale));
					const source = mask.getAsFloat32Array();
					const values = new Uint8Array(width * height);
					for (let y = 0; y < height; y++)
						for (let x = 0; x < width; x++) {
							const sourceX = Math.min(
								mask.width - 1,
								Math.floor(((x + 0.5) * mask.width) / width),
							);
							const sourceY = Math.min(
								mask.height - 1,
								Math.floor(((y + 0.5) * mask.height) / height),
							);
							values[y * width + x] = Math.round(
								(source[sourceY * mask.width + sourceX] ?? 0) * 255,
							);
						}
					return { width, height, values };
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
			result.close();
		}
	} finally {
		image.close();
	}
};
// Serialize model initialization and inference so every detector stays on its owner.
let queue = Promise.resolve();
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	queue = queue
		.then(() => answerWorkerRequest(event.data))
		.catch((error) => {
			const isErrorInstanceError = error instanceof Error;
			return send({
				type: "error",
				generation,
				message: isErrorInstanceError ? error.message : String(error),
			});
		});
};
