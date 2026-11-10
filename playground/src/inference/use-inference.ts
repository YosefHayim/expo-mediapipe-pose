import { type RefObject, useEffect, useRef, useState } from "react";
import type { Config } from "@/config";
import type {
	BrowserFrame,
	BrowserMask,
	SourceMode,
	WorkerRequest,
	WorkerResponse,
} from "@/types";
import InferenceWorker from "./inference.worker?worker&inline";

interface Options {
	config: Config;
	mode: SourceMode;
	url: string;
	device: string;
	paused: boolean;
	model: ArrayBuffer | null;
	image: RefObject<HTMLImageElement | null>;
	video: RefObject<HTMLVideoElement | null>;
	onFrame: (frame: BrowserFrame, masks: BrowserMask[]) => void;
}
export const useInference = (options: Options) => {
	const { config, mode, url, device, paused, model, image, video } = options;
	const [status, setStatus] = useState("Loading model…");
	const [error, setError] = useState<string | null>(null);
	const [retry, setRetry] = useState(0);
	const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
	const [actualCapture, setActualCapture] = useState<string | null>(null);
	const [cadence, setCadence] = useState({ inference: 0, results: 0 });
	const latest = useRef(options);
	latest.current = options;
	const detectionKey = JSON.stringify(config.detection);
	// biome-ignore lint/correctness/useExhaustiveDependencies: The serialized detection options and explicit retry key define a detector generation; styling and rate caps must not restart it.
	useEffect(() => {
		setError(null);
		setActualCapture(null);
		setCadence({ inference: 0, results: 0 });

		const isModeReplay = mode === "replay";
		if (isModeReplay) {
			setStatus("Landmark replay");
			return;
		}

		if (paused) {
			setStatus("Paused");
			return;
		}

		const isCustomModelMissing =
			config.detection.modelVariant !== "full" && !model;
		if (isCustomModelMissing) {
			setStatus("Choose a local model");
			return;
		}

		const isModePhotoOrVideoAndUrlMissing =
			(mode === "photo" || mode === "video") && !url;
		if (isModePhotoOrVideoAndUrlMissing) {
			setStatus("Choose a file to begin");
			return;
		}

		let disposed = false;
		let failed = false;
		let stream: MediaStream | undefined;
		const previewVideo = video.current;
		let timer = 0;
		let ready = false;
		let busy = false;
		let stillSent = false;
		let lastTimestamp = 0;
		let lastDelivery = -Infinity;
		let lastVideoTime = -1;
		let windowStart = performance.now();
		let inferenceCount = 0;
		let resultCount = 0;
		// Inline blob workers inherit the document CSP, including same-origin-only networking.
		const worker = new InferenceWorker();
		const send = (message: WorkerRequest, transfer: Transferable[] = []) =>
			worker.postMessage(message, transfer);
		const fail = (message: string) => {
			const isDisposedOrFailed = disposed || failed;
			if (isDisposedOrFailed) return;

			failed = true;
			cancelAnimationFrame(timer);
			ready = false;
			setError(message);
			setStatus("Needs attention");
			stream?.getTracks().forEach((track) => {
				track.stop();
			});
			previewVideo?.pause();
			send({ type: "close" });
			setTimeout(() => worker.terminate(), 100);
		};
		const tick = async () => {
			const isDisposedOrFailed = disposed || failed;
			if (isDisposedOrFailed) return;

			timer = requestAnimationFrame(() => void tick());
			const now = performance.now();

			const { timing } = latest.current.config;

			const isFrameSkipped =
				!ready || busy || now - lastTimestamp < 1000 / timing.frameLimit;
			if (isFrameSkipped) return;

			const isMoving = mode === "camera" || mode === "video";

			const source = isMoving ? video.current : image.current;

			const isSourceMissing = source == null;
			if (isSourceMissing) return;

			const isVideoSource = source instanceof HTMLVideoElement;
			if (isVideoSource) {
				const isVideoFrameSkipped =
					source.readyState < 2 ||
					source.paused ||
					source.currentTime === lastVideoTime;
				if (isVideoFrameSkipped) return;
			} else {
				const isImageNotReady =
					!source.complete || source.naturalWidth === 0 || stillSent;
				if (isImageNotReady) return;

				const isSourceUrlChanged =
					source.currentSrc !== new URL(url, location.href).href;
				if (isSourceUrlChanged) return;
			}

			busy = true;
			try {
				const width = isVideoSource ? source.videoWidth : source.naturalWidth;
				const height = isVideoSource
					? source.videoHeight
					: source.naturalHeight;
				const scale = Math.min(1, 1280 / Math.max(width, height));
				const bitmap = await createImageBitmap(source, {
					resizeWidth: Math.max(1, Math.round(width * scale)),
					resizeHeight: Math.max(1, Math.round(height * scale)),
				});

				const isDisposedOrFailed = disposed || failed;
				if (isDisposedOrFailed) {
					bitmap.close();
					return;
				}

				lastTimestamp = performance.now();

				if (isVideoSource) lastVideoTime = source.currentTime;

				stillSent = true;
				send(
					{
						type: "frame",
						image: bitmap,
						timestamp: lastTimestamp,
						video: moving,
						generation: 1,
					},
					[bitmap],
				);
			} catch (cause) {
				busy = false;
				fail(String(cause));
			}
		};
		worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
			const isDisposedOrFailed = disposed || failed;
			if (isDisposedOrFailed) return;

			const message = event.data;

			const isMessageTypeError = message.type === "error";
			if (isMessageTypeError) {
				busy = false;
				fail(message.message);
				return;
			}

			const isMessageTypeReady = message.type === "ready";
			if (isMessageTypeReady) {
				ready = true;
				setStatus("Ready");
				return;
			}

			busy = false;
			const now = performance.now();
			inferenceCount++;

			const still = mode === "sample" || mode === "photo";

			const isDeliveryDue =
				still ||
				now - lastDelivery >= 1000 / latest.current.config.timing.callbackFps;
			if (isDeliveryDue) {
				lastDelivery = now;
				resultCount++;
				latest.current.onFrame(message.frame, message.masks);
				const hasPoses = message.frame.poses.length !== 0;
				setStatus(hasPoses ? "Detection ready" : "No person detected");
			}

			const isFpsWindowElapsed = now - windowStart >= 1000;
			if (isFpsWindowElapsed) {
				const seconds = (now - windowStart) / 1000;
				setCadence({
					inference: inferenceCount / seconds,
					results: resultCount / seconds,
				});
				inferenceCount = 0;
				resultCount = 0;
				windowStart = now;
			}
		};
		worker.onerror = (event) =>
			fail(
				event.message ||
					"The inference worker could not start. Try a current Chrome or Safari browser.",
			);
		const start = async () => {
			try {
				setStatus("Loading model…");

				const isModeCamera = mode === "camera";
				if (isModeCamera) {
					const isCameraUnsupported = !navigator.mediaDevices?.getUserMedia;
					if (isCameraUnsupported)
						throw new Error(
							"Camera access requires HTTPS and a browser with camera support.",
						);

					const camera: MediaTrackConstraints = {
						frameRate: { ideal: config.timing.previewFps },
					};

					if (device) camera.deviceId = { exact: device };
					else camera.facingMode = "user";

					stream = await navigator.mediaDevices.getUserMedia({
						video: camera,
						audio: false,
					});

					const isDisposedOrFailed = disposed || failed;
					if (isDisposedOrFailed) {
						stream.getTracks().forEach((track) => {
							track.stop();
						});
						return;
					}

					const element = previewVideo;

					const isElementMissing = element == null;
					if (isElementMissing) throw new Error("Camera preview unavailable.");

					element.srcObject = stream;
					await element.play();

					const isDisposedOrFailedAfterPlay = disposed || failed;
					if (isDisposedOrFailedAfterPlay) return;

					const settings = stream.getVideoTracks()[0]?.getSettings();
					setActualCapture(
						`${settings?.width ?? "?"} × ${settings?.height ?? "?"} · ${settings?.frameRate?.toFixed(1) ?? "?"} fps capture`,
					);
					setDevices(
						(await navigator.mediaDevices.enumerateDevices()).filter(
							(item) => item.kind === "videoinput",
						),
					);
				}

				const isDisposedOrFailed = disposed || failed;
				if (isDisposedOrFailed) return;

				send({
					type: "init",
					base: new URL(import.meta.env.BASE_URL, location.origin).href,
					detection: config.detection,
					model,
					generation: 1,
				});
				timer = requestAnimationFrame(() => void tick());
			} catch (cause) {
				const isCauseError = cause instanceof Error;
				fail(isCauseError ? cause.message : String(cause));
			}
		};
		void start();
		return () => {
			disposed = true;
			cancelAnimationFrame(timer);
			stream?.getTracks().forEach((track) => {
				track.stop();
			});

			if (previewVideo) {
				previewVideo.pause();
				previewVideo.srcObject = null;

				const isPreviewVideoDisconnected = !previewVideo.isConnected;
				if (isPreviewVideoDisconnected) {
					previewVideo.removeAttribute("src");
					previewVideo.load();
				}
			}

			// Finish any in-flight inference, close on the worker, then reclaim WASM memory.
			send({ type: "close" });
			setTimeout(() => worker.terminate(), 100);
		};
	}, [
		detectionKey,
		mode,
		url,
		device,
		paused,
		model,
		retry,
		config.timing.previewFps,
		image,
		video,
	]);
	return {
		status,
		error,
		retry: () => setRetry((value) => value + 1),
		devices,
		actualCapture,
		cadence,
	};
};
