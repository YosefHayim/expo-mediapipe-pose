import {
	createDetectionSkeleton,
	initialPoseRuleState,
	type PoseRuleState,
	selectPose,
} from "expo-mediapipe-pose/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSkeletonSettings, generateCode } from "@/codegen";
import {
	type Config,
	createDefaultSettings,
	parseConfig,
	readPresetSettings,
} from "@/config";
import { useInference } from "@/inference/use-inference";
import {
	MAX_RECORDING_FRAMES,
	parseRecording,
	RECORDING_ENVELOPE_BYTES,
	type Recording,
	readFrameAt,
} from "@/recording";
import { updateRules } from "@/rules";
import { base } from "@/site";
import type { BrowserFrame, BrowserMask, SourceMode } from "@/types";

const readInitialConfiguration = (): {
	config: Config;
	error: string | null;
} => {
	try {
		const hash = new URLSearchParams(location.hash.slice(1));
		const value = hash.get("config");
		const isSharedSetupInHash = value !== null && value !== "";
		return {
			config: isSharedSetupInHash
				? parseConfig(value)
				: createDefaultSettings(),
			error: null,
		};
	} catch {
		return {
			config: createDefaultSettings(),
			error:
				"The shared configuration is invalid or unsupported. Library defaults are shown instead.",
		};
	}
};

export const usePlayground = () => {
	const [initial] = useState(readInitialConfiguration);
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
	const isModeSample = mode === "sample";
	const sourceUrl = isModeSample ? `${base}${sample}` : upload;
	const setConfig = (next: Config) => {
		const isModelVariantChanged =
			next.detection.modelVariant !== config.detection.modelVariant;
		if (isModelVariantChanged) {
			setModel(null);
			setModelName("");
		}

		setConfigState(next);
	};
	const finishRecording = useCallback(() => {
		setRecording(false);

		const hasRecordedFrames = recordRef.current.length > 0;
		if (hasRecordedFrames)
			setRecorded({
				format: "pose-playground",
				version: 1,
				frames: [...recordRef.current],
			});
	}, []);
	const acceptFrame = (next: BrowserFrame, nextMasks: BrowserMask[]) => {
		receivedAt.current = performance.now();
		setFrame(next);
		setMasks(nextMasks);

		const isRecordingMissing = recording == null;
		if (isRecordingMissing) return;

		const now = performance.now();

		const isRecordEmpty = recordRef.current.length === 0;
		if (isRecordEmpty) recordStart.current = now;

		const entry = { timestampMs: now - recordStart.current, frame: next };
		const separatorBytes = isRecordEmpty ? 0 : 1;

		const size = JSON.stringify(entry).length + separatorBytes;

		const isRecordingTooLarge = recordSize.current + size > 15 * 1024 * 1024;
		if (isRecordingTooLarge) {
			finishRecording();
			setMessage("Recording stopped at the 15 MiB limit.");
			return;
		}

		recordSize.current += size;
		recordRef.current.push(entry);
		setRecordCount(recordRef.current.length);

		const isRecordingFull = recordRef.current.length >= MAX_RECORDING_FRAMES;
		if (isRecordingFull) {
			finishRecording();
			setMessage("Recording complete: 1,800-frame limit reached.");
		}
	};
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
		const updateHiddenFromDocument = () => setHidden(document.hidden);
		document.addEventListener("visibilitychange", updateHiddenFromDocument);
		return () =>
			document.removeEventListener(
				"visibilitychange",
				updateHiddenFromDocument,
			);
	}, []);
	useEffect(
		() => () => {
			const isBlobUpload = upload.startsWith("blob:");
			if (isBlobUpload) URL.revokeObjectURL(upload);
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
		const isFrameMissing = frame == null;
		if (isFrameMissing) return;

		const now = performance.now();
		ruleRef.current = updateRules({
			frame,
			poseIndex: config.skeleton.poseIndex,
			rules: config.rules,
			previous: ruleRef.current,
			now,
		});
		setRuleStates(ruleRef.current);
	}, [frame, config.rules, config.skeleton.poseIndex]);
	useEffect(() => {
		const timer = setInterval(() => {
			const now = performance.now();

			const stillImage = mode === "sample" || mode === "photo";

			const canUpdateRulesFromFrame = frame && stillImage && !paused && !hidden;
			if (canUpdateRulesFromFrame) {
				ruleRef.current = updateRules({
					frame,
					poseIndex: config.skeleton.poseIndex,
					rules: config.rules,
					previous: ruleRef.current,
					now,
				});
			} else {
				ruleRef.current = ruleRef.current.map((state, index) => {
					const isRuleStale =
						now - state.updatedAt > (config.rules[index]?.staleAfterMs ?? 500);
					return isRuleStale ? initialPoseRuleState() : state;
				});

				const staleOverlay =
					now - receivedAt.current >
					Math.max(
						500,
						2000 /
							Math.min(config.timing.frameLimit, config.timing.callbackFps),
					);

				const isOverlayStaleOutsideReplay = staleOverlay && mode !== "replay";
				if (isOverlayStaleOutsideReplay) {
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
		const isReplayStopped = !playing || !replay || hidden;
		if (isReplayStopped) return;

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
			setFrame(readFrameAt(replay, nextPosition));
			receivedAt.current = performance.now();

			const isNextPositionPastDuration = nextPosition >= duration;
			if (isNextPositionPastDuration) {
				setPlaying(false);
				return;
			}

			timer = requestAnimationFrame(tick);
		};
		timer = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(timer);
	}, [playing, replay, speed, hidden]);
	const changeMode = (next: SourceMode) => {
		finishRecording();
		setMode(next);
		setUpload("");
		setPaused(false);
		setPlaying(false);
		setMessage(null);

		const isNextReplayAndReplayPresent = next === "replay" && replay;
		if (isNextReplayAndReplayPresent) {
			setPosition(0);
			setTimeout(() => setFrame(readFrameAt(replay, 0)), 0);
		}
	};
	const loadFile = async (
		file: File,
		kind: "media" | "recording" | "config" | "model",
	) => {
		try {
			const isKindConfig = kind === "config";
			if (isKindConfig) {
				const isConfigOverLimit = file.size > 40000;
				if (isConfigOverLimit)
					throw new Error("Configuration exceeds 40,000 bytes.");

				setConfig(parseConfig(await file.text()));
				setMessage("Configuration imported.");
				return;
			}

			const isKindRecording = kind === "recording";
			if (isKindRecording) {
				const isRecordingFileTooLarge = file.size > 16 * 1024 * 1024;
				if (isRecordingFileTooLarge)
					throw new Error("Recording exceeds 16 MiB.");

				const parsed = parseRecording(await file.text());

				const isParsedFramesEmpty = parsed.frames.length === 0;
				if (isParsedFramesEmpty)
					setMessage(
						"This recording contains no frames. Import another recording to replay landmarks.",
					);

				setReplay(parsed);
				setPlaying(false);
				setPosition(0);
				setFrame(readFrameAt(parsed, 0));
				setMasks([]);
				return;
			}

			const isKindModel = kind === "model";
			if (isKindModel) {
				const isModelFileTooLarge = file.size > 100 * 1024 * 1024;
				if (isModelFileTooLarge) throw new Error("Model exceeds 100 MiB.");

				setModel(await file.arrayBuffer());
				setModelName(file.name);
				return;
			}

			const isMediaFileTooLarge = file.size > 200 * 1024 * 1024;
			if (isMediaFileTooLarge)
				throw new Error("Media exceeds the 200 MiB browser limit.");

			finishRecording();
			setUpload(URL.createObjectURL(file));
			setPaused(false);
		} catch (error) {
			const isErrorInstanceError = error instanceof Error;
			setMessage(isErrorInstanceError ? error.message : String(error));
		}
	};
	const copy = async (text: string, success: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setMessage(success);
		} catch {
			setMessage(
				"Clipboard unavailable. Select and copy the code, or export the configuration file.",
			);
		}
	};
	const choosePreset = (name: string) => {
		setConfig(readPresetSettings(name));
		const isNameMultiple = name === "multiple";
		setSample(isNameMultiple ? "man-woman-okay.jpg" : "pose.jpg");
		setMode("sample");
		setPaused(false);
		setPlaying(false);
		finishRecording();
	};
	const isFramePresent = frame !== null;
	const selected = isFramePresent
		? selectPose(frame, config.skeleton.poseIndex)
		: null;
	const options = createSkeletonSettings(config);
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
	const skeleton = isFramePresent
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
