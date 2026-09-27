import { type RefObject, useEffect, useRef, useState } from "react";
import type { Config } from "./config";
import InferenceWorker from "./inference.worker?worker&inline";
import type {
	BrowserFrame,
	BrowserMask,
	SourceMode,
	WorkerRequest,
	WorkerResponse,
} from "./types";

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
export function useInference(options: Options) {
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
		if (mode === "replay") {
			setStatus("Landmark replay");
			return;
		}
		if (paused) {
			setStatus("Paused");
			return;
		}
		if (config.detection.modelVariant !== "full" && !model) {
			setStatus("Choose a local model");
			return;
		}
		if ((mode === "photo" || mode === "video") && !url) {
			setStatus("Choose a file to begin");
			return;
		}
		let disposed = false;
		let stream: MediaStream | undefined;
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
			if (disposed) return;
			ready = false;
			setError(message);
			setStatus("Needs attention");
			stream?.getTracks().forEach((track) => {
				track.stop();
			});
			video.current?.pause();
			send({ type: "close" });
			setTimeout(() => worker.terminate(), 100);
		};
		const tick = async () => {
			if (disposed) return;
			timer = requestAnimationFrame(() => void tick());
			const now = performance.now();
			const { timing } = latest.current.config;
			if (!ready || busy || now - lastTimestamp < 1000 / timing.frameLimit)
				return;
			const moving = mode === "camera" || mode === "video";
			const source = moving ? video.current : image.current;
			if (!source) return;
			if (source instanceof HTMLVideoElement) {
				if (
					source.readyState < 2 ||
					source.paused ||
					source.currentTime === lastVideoTime
				)
					return;
			} else if (!source.complete || source.naturalWidth === 0 || stillSent)
				return;
			busy = true;
			try {
				const width =
					source instanceof HTMLVideoElement
						? source.videoWidth
						: source.naturalWidth;
				const height =
					source instanceof HTMLVideoElement
						? source.videoHeight
						: source.naturalHeight;
				const scale = Math.min(1, 1280 / Math.max(width, height));
				const bitmap = await createImageBitmap(source, {
					resizeWidth: Math.max(1, Math.round(width * scale)),
					resizeHeight: Math.max(1, Math.round(height * scale)),
				});
				if (disposed) {
					bitmap.close();
					return;
				}
				lastTimestamp = performance.now();
				if (source instanceof HTMLVideoElement)
					lastVideoTime = source.currentTime;
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
			if (disposed) return;
			const message = event.data;
			if (message.type === "error") {
				busy = false;
				fail(message.message);
				return;
			}
			if (message.type === "ready") {
				ready = true;
				setStatus("Ready");
				return;
			}
			busy = false;
			const now = performance.now();
			inferenceCount++;
			const still = mode === "sample" || mode === "photo";
			if (
				still ||
				now - lastDelivery >= 1000 / latest.current.config.timing.callbackFps
			) {
				lastDelivery = now;
				resultCount++;
				latest.current.onFrame(message.frame, message.masks);
				setStatus(
					message.frame.poses.length ? "Detection ready" : "No person detected",
				);
			}
			if (now - windowStart >= 1000) {
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
		async function start() {
			try {
				setStatus("Loading model…");
				if (mode === "camera") {
					if (!navigator.mediaDevices?.getUserMedia)
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
					if (disposed) {
						stream.getTracks().forEach((track) => {
							track.stop();
						});
						return;
					}
					const element = video.current;
					if (!element) throw new Error("Camera preview unavailable.");
					element.srcObject = stream;
					await element.play();
					if (disposed) return;
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
				if (disposed) return;
				send({
					type: "init",
					base: new URL(import.meta.env.BASE_URL, location.origin).href,
					detection: config.detection,
					model,
					generation: 1,
				});
				timer = requestAnimationFrame(() => void tick());
			} catch (cause) {
				fail(cause instanceof Error ? cause.message : String(cause));
			}
		}
		void start();
		return () => {
			disposed = true;
			cancelAnimationFrame(timer);
			stream?.getTracks().forEach((track) => {
				track.stop();
			});
			if (video.current) {
				video.current.pause();
				video.current.srcObject = null;
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
}
