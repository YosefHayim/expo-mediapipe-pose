import {
	createDetectionSkeleton,
	initialPoseRuleState,
	type PoseRuleState,
	selectPose,
} from "expo-mediapipe-pose/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateCode, skeletonOptions } from "@/codegen";
import { type Config, defaults, parseConfig, preset } from "@/config";
import { useInference } from "@/inference/use-inference";
import {
	frameAt,
	MAX_RECORDING_FRAMES,
	parseRecording,
	RECORDING_ENVELOPE_BYTES,
	type Recording,
} from "@/recording";
import { updateRules } from "@/rules";
import { base } from "@/site";
import type { BrowserFrame, BrowserMask, SourceMode } from "@/types";

function initialConfiguration(): { config: Config; error: string | null } {
	try {
		const hash = new URLSearchParams(location.hash.slice(1));
		const value = hash.get("config");
		return { config: value ? parseConfig(value) : defaults(), error: null };
	} catch {
		return {
			config: defaults(),
			error:
				"The shared configuration is invalid or unsupported. Library defaults are shown instead.",
		};
	}
}

export const usePlayground = () => {
	const [initial] = useState(initialConfiguration);
	const [config, setConfigState] = useState(initial.config);
	const [message, setMessage] = useState<string | null>(initial.error);
	const [mode, setMode] = useState<SourceMode>("sample");
	const [sample, setSample] = useState("pose.jpg");
	const [upload, setUpload] = useState("");
	const [device, setDevice] = useState("");
	const [mirrored, setMirrored] = useState(true);
	const [paused, setPaused] = useState(false);
	const [hidden, setHidden] = useState(document.hidden);
	const [frame, setFrame] = useState<BrowserFrame | null>(null);
	const [masks, setMasks] = useState<BrowserMask[]>([]);
	const [model, setModel] = useState<ArrayBuffer | null>(null);
	const [modelName, setModelName] = useState("");
	const [ruleStates, setRuleStates] = useState<PoseRuleState[]>([]);
	const ruleRef = useRef<PoseRuleState[]>([]);
	const receivedAt = useRef(0);
	const image = useRef<HTMLImageElement>(null);
	const video = useRef<HTMLVideoElement>(null);
	const [recording, setRecording] = useState(false);
	const [recorded, setRecorded] = useState<Recording | null>(null);
	const recordRef = useRef<Array<{ timestampMs: number; frame: BrowserFrame }>>(
		[],
	);
	const recordStart = useRef(0);
	const recordSize = useRef(RECORDING_ENVELOPE_BYTES);
	const [recordCount, setRecordCount] = useState(0);
	const [replay, setReplay] = useState<Recording | null>(null);
	const [position, setPosition] = useState(0);
	const positionRef = useRef(position);
	positionRef.current = position;
	const [speed, setSpeed] = useState(1);
	const [playing, setPlaying] = useState(false);
	const [videoProgress, setVideoProgress] = useState({
		position: 0,
		duration: 0,
	});
	const [resultTab, setResultTab] = useState("feedback");
	const [codeMode, setCodeMode] = useState<SourceMode>("camera");
	const sourceUrl = mode === "sample" ? `${base}${sample}` : upload;
	const setConfig = (next: Config) => {
		if (next.detection.modelVariant !== config.detection.modelVariant) {
			setModel(null);
			setModelName("");
		}
		setConfigState(next);
	};
	const finishRecording = useCallback(() => {
		setRecording(false);
		if (recordRef.current.length)
			setRecorded({
				format: "pose-playground",
				version: 1,
				frames: [...recordRef.current],
			});
	}, []);
	function acceptFrame(next: BrowserFrame, nextMasks: BrowserMask[]) {
		receivedAt.current = performance.now();
		setFrame(next);
		setMasks(nextMasks);
		if (!recording) return;
		const now = performance.now();
		if (recordRef.current.length === 0) recordStart.current = now;
		const entry = { timestampMs: now - recordStart.current, frame: next };
		const separatorBytes = recordRef.current.length === 0 ? 0 : 1;
		const size = JSON.stringify(entry).length + separatorBytes;
		if (recordSize.current + size > 15 * 1024 * 1024) {
			finishRecording();
			setMessage("Recording stopped at the 15 MiB limit.");
			return;
		}
		recordSize.current += size;
		recordRef.current.push(entry);
		setRecordCount(recordRef.current.length);
		if (recordRef.current.length >= MAX_RECORDING_FRAMES) {
			finishRecording();
			setMessage("Recording complete: 1,800-frame limit reached.");
		}
	}
	const engine = useInference({
		config,
		mode,
		url: sourceUrl,
		device,
		paused: paused || hidden,
		model,
		image,
		video,
		onFrame: acceptFrame,
	});
	const detectionKey = JSON.stringify(config.detection);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A recording belongs to one uninterrupted input generation.
	useEffect(() => {
		finishRecording();
	}, [
		finishRecording,
		engine.error,
		hidden,
		paused,
		mode,
		sourceUrl,
		device,
		detectionKey,
		model,
		config.timing.previewFps,
	]);
	useEffect(() => {
		const visibility = () => setHidden(document.hidden);
		document.addEventListener("visibilitychange", visibility);
		return () => document.removeEventListener("visibilitychange", visibility);
	}, []);
	useEffect(
		() => () => {
			if (upload.startsWith("blob:")) URL.revokeObjectURL(upload);
		},
		[upload],
	);
	// biome-ignore lint/correctness/useExhaustiveDependencies: These inputs invalidate the current detection even before the worker produces another frame.
	useEffect(() => {
		setFrame(null);
		setMasks([]);
		receivedAt.current = 0;
	}, [
		mode,
		sourceUrl,
		device,
		detectionKey,
		paused,
		hidden,
		model,
		engine.error,
	]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Selection and source transitions reset temporal history.
	useEffect(() => {
		ruleRef.current = config.rules.map(() => initialPoseRuleState());
		setRuleStates(ruleRef.current);
	}, [
		config.rules,
		config.skeleton.poseIndex,
		mode,
		sourceUrl,
		paused,
		playing,
	]);
	useEffect(() => {
		if (!frame) return;
		const now = performance.now();
		ruleRef.current = updateRules(
			frame,
			config.skeleton.poseIndex,
			config.rules,
			ruleRef.current,
			now,
		);
		setRuleStates(ruleRef.current);
	}, [frame, config.rules, config.skeleton.poseIndex]);
	useEffect(() => {
		const timer = setInterval(() => {
			const now = performance.now();
			const stillImage = mode === "sample" || mode === "photo";
			if (frame && stillImage && !paused && !hidden) {
				ruleRef.current = updateRules(
					frame,
					config.skeleton.poseIndex,
					config.rules,
					ruleRef.current,
					now,
				);
			} else {
				ruleRef.current = ruleRef.current.map((state, index) =>
					now - state.updatedAt > (config.rules[index]?.staleAfterMs ?? 500)
						? initialPoseRuleState()
						: state,
				);
				const staleOverlay =
					now - receivedAt.current >
					Math.max(
						500,
						2000 /
							Math.min(config.timing.frameLimit, config.timing.callbackFps),
					);
				if (staleOverlay && mode !== "replay") {
					setFrame(null);
					setMasks([]);
				}
			}
			setRuleStates([...ruleRef.current]);
		}, 100);
		return () => clearInterval(timer);
	}, [
		frame,
		config.rules,
		mode,
		paused,
		hidden,
		config.skeleton.poseIndex,
		config.timing,
	]);
	useEffect(() => {
		if (!playing || !replay || hidden) return;
		const started = performance.now();
		const initialPosition = positionRef.current;
		const duration = replay.frames.at(-1)?.timestampMs ?? 0;
		let timer = 0;
		const tick = () => {
			const nextPosition = Math.min(
				duration,
				initialPosition + (performance.now() - started) * speed,
			);
			setPosition(nextPosition);
			setFrame(frameAt(replay, nextPosition));
			receivedAt.current = performance.now();
			if (nextPosition >= duration) {
				setPlaying(false);
				return;
			}
			timer = requestAnimationFrame(tick);
		};
		timer = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(timer);
	}, [playing, replay, speed, hidden]);
	function changeMode(next: SourceMode) {
		finishRecording();
		setMode(next);
		setUpload("");
		setPaused(false);
		setPlaying(false);
		setMessage(null);
		if (next === "replay" && replay) {
			setPosition(0);
			setTimeout(() => setFrame(frameAt(replay, 0)), 0);
		}
	}
	async function loadFile(
		file: File,
		kind: "media" | "recording" | "config" | "model",
	) {
		try {
			if (kind === "config") {
				if (file.size > 40000)
					throw new Error("Configuration exceeds 40,000 bytes.");
				setConfig(parseConfig(await file.text()));
				setMessage("Configuration imported.");
				return;
			}
			if (kind === "recording") {
				if (file.size > 16 * 1024 * 1024)
					throw new Error("Recording exceeds 16 MiB.");
				const parsed = parseRecording(await file.text());
				if (parsed.frames.length === 0)
					setMessage(
						"This recording contains no frames. Import another recording to replay landmarks.",
					);
				setReplay(parsed);
				setPlaying(false);
				setPosition(0);
				setFrame(frameAt(parsed, 0));
				setMasks([]);
				return;
			}
			if (kind === "model") {
				if (file.size > 100 * 1024 * 1024)
					throw new Error("Model exceeds 100 MiB.");
				setModel(await file.arrayBuffer());
				setModelName(file.name);
				return;
			}
			if (file.size > 200 * 1024 * 1024)
				throw new Error("Media exceeds the 200 MiB browser limit.");
			finishRecording();
			setUpload(URL.createObjectURL(file));
			setPaused(false);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		}
	}
	async function copy(text: string, success: string) {
		try {
			await navigator.clipboard.writeText(text);
			setMessage(success);
		} catch {
			setMessage(
				"Clipboard unavailable. Select and copy the code, or export the configuration file.",
			);
		}
	}
	function choosePreset(name: string) {
		setConfig(preset(name));
		setSample(name === "multiple" ? "man-woman-okay.jpg" : "pose.jpg");
		setMode("sample");
		setPaused(false);
		setPlaying(false);
		finishRecording();
	}
	const selected = frame ? selectPose(frame, config.skeleton.poseIndex) : null;
	const options = skeletonOptions(config);
	const joints = { ...options.joints };
	config.rules.forEach((rule, index) => {
		const status = ruleStates[index]?.status ?? "unknown";
		const color = {
			pass: rule.passColor,
			fail: rule.failColor,
			unknown: rule.unknownColor,
		}[status];
		joints[rule.vertex] = { ...joints[rule.vertex], color };
	});
	const skeleton = frame
		? createDetectionSkeleton(frame, frame.imageSize, { ...options, joints })
		: { points: [], lines: [] };
	const code = generateCode(config, codeMode, model !== null);
	const duration = replay?.frames.at(-1)?.timestampMs ?? 0;
	const sourceHasMedia =
		mode === "sample" || mode === "camera" || Boolean(upload);
	return {
		changeMode,
		choosePreset,
		code,
		codeMode,
		config,
		copy,
		device,
		duration,
		engine,
		finishRecording,
		frame,
		image,
		loadFile,
		masks,
		message,
		mirrored,
		mode,
		modelName,
		paused,
		playing,
		position,
		recordCount,
		recordRef,
		recordSize,
		recorded,
		recording,
		replay,
		resultTab,
		ruleRef,
		ruleStates,
		sample,
		selected,
		setCodeMode,
		setConfig,
		setDevice,
		setFrame,
		setMasks,
		setMessage,
		setMirrored,
		setModel,
		setModelName,
		setPaused,
		setPlaying,
		setPosition,
		setRecordCount,
		setRecording,
		setReplay,
		setResultTab,
		setSample,
		setSpeed,
		setUpload,
		setVideoProgress,
		skeleton,
		sourceHasMedia,
		sourceUrl,
		speed,
		upload,
		video,
		videoProgress,
	};
};

export type PlaygroundScreen = ReturnType<typeof usePlayground>;
