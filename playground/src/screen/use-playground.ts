import {
	createDetectionSkeleton,
	initialPoseRuleState,
	type PoseRuleState,
	selectPose,
} from "expo-mediapipe-pose/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSkeletonSettings, generateCode } from "@/codegen";
import {
	createDefaultSettings,
	parseSettings,
	readPresetSettings,
	type Settings,
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
import type { BrowserFrame, BrowserMask, MediaMode } from "@/types";

const readInitialConfiguration = (): {
	config: Settings;
	error: string | null;
} => {
	try {
		const hash = new URLSearchParams(location.hash.slice(1));
		const encodedSettings = hash.get("config");
		const isSharedSetupInHash =
			encodedSettings !== null && encodedSettings !== "";
		return {
			config: isSharedSetupInHash
				? parseSettings(encodedSettings)
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
	const [settings, setSettingsStatus] = useState(initial.config);
	const [message, setMessage] = useState<string | null>(initial.error);
	const [mode, setMode] = useState<MediaMode>("sample");
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
	const [ruleStatuses, setRuleStatuses] = useState<PoseRuleState[]>([]);
	const ruleRef = useRef<PoseRuleState[]>([]);
	const receivedAt = useRef(0);
	const image = useRef<HTMLImageElement>(null);
	const video = useRef<HTMLVideoElement>(null);
	const [recording, setRecording] = useState(false);
	const [recorded, setRecorded] = useState<Recording | null>(null);
	const recordingRef = useRef<
		Array<{ timestampMs: number; frame: BrowserFrame }>
	>([]);
	const recordingStart = useRef(0);
	const recordingSize = useRef(RECORDING_ENVELOPE_BYTES);
	const [recordingCount, setRecordingCount] = useState(0);
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
	const [reportTab, setReportTab] = useState("feedback");
	const [codeMode, setCodeMode] = useState<MediaMode>("camera");
	const isModeSample = mode === "sample";
	const mediaUrl = isModeSample ? `${base}${sample}` : upload;
	const setSettings = (next: Settings) => {
		const isModelVariantChanged =
			next.detection.modelVariant !== settings.detection.modelVariant;
		if (isModelVariantChanged) {
			setModel(null);
			setModelName("");
		}

		setSettingsStatus(next);
	};
	const finishRecording = useCallback(() => {
		setRecording(false);

		const hasRecordedFrames = recordingRef.current.length > 0;
		if (hasRecordedFrames)
			setRecorded({
				format: "pose-playground",
				version: 1,
				frames: [...recordingRef.current],
			});
	}, []);
	const acceptFrame = (next: BrowserFrame, nextMasks: BrowserMask[]) => {
		receivedAt.current = performance.now();
		setFrame(next);
		setMasks(nextMasks);

		const isRecordingMissing = recording == null;
		if (isRecordingMissing) return;

		const now = performance.now();

		const isRecordingEmpty = recordingRef.current.length === 0;
		if (isRecordingEmpty) recordingStart.current = now;

		const line = { timestampMs: now - recordingStart.current, frame: next };
		const separatorBytes = isRecordingEmpty ? 0 : 1;

		const size = JSON.stringify(line).length + separatorBytes;

		const isRecordingTooLarge = recordingSize.current + size > 15 * 1024 * 1024;
		if (isRecordingTooLarge) {
			finishRecording();
			setMessage("Recording stopped at the 15 MiB limit.");
			return;
		}

		recordingSize.current += size;
		recordingRef.current.push(line);
		setRecordingCount(recordingRef.current.length);

		const isRecordingFull = recordingRef.current.length >= MAX_RECORDING_FRAMES;
		if (isRecordingFull) {
			finishRecording();
			setMessage("Recording complete: 1,800-frame limit reached.");
		}
	};
	const engine = useInference({
		config: settings,
		mode,
		url: mediaUrl,
		device,
		paused: paused || hidden,
		model,
		image,
		video,
		onFrame: acceptFrame,
	});
	const detectionKey = JSON.stringify(settings.detection);
	// biome-ignore lint/correctness/useExhaustiveDependencies: A recording belongs to one uninterrupted input generation.
	useEffect(() => {
		finishRecording();
	}, [
		finishRecording,
		engine.error,
		hidden,
		paused,
		mode,
		mediaUrl,
		device,
		detectionKey,
		model,
		settings.timing.previewFps,
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
		mediaUrl,
		device,
		detectionKey,
		paused,
		hidden,
		model,
		engine.error,
	]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: Selection and source transitions reset temporal history.
	useEffect(() => {
		ruleRef.current = settings.rules.map(() => initialPoseRuleState());
		setRuleStatuses(ruleRef.current);
	}, [
		settings.rules,
		settings.skeleton.poseIndex,
		mode,
		mediaUrl,
		paused,
		playing,
	]);
	useEffect(() => {
		const isFrameMissing = frame == null;
		if (isFrameMissing) return;

		const now = performance.now();
		ruleRef.current = updateRules({
			frame,
			poseIndex: settings.skeleton.poseIndex,
			rules: settings.rules,
			previous: ruleRef.current,
			now,
		});
		setRuleStatuses(ruleRef.current);
	}, [frame, settings.rules, settings.skeleton.poseIndex]);
	useEffect(() => {
		const timer = setInterval(() => {
			const now = performance.now();

			const stillImage = mode === "sample" || mode === "photo";

			const canUpdateRulesFromFrame = frame && stillImage && !paused && !hidden;
			if (canUpdateRulesFromFrame) {
				ruleRef.current = updateRules({
					frame,
					poseIndex: settings.skeleton.poseIndex,
					rules: settings.rules,
					previous: ruleRef.current,
					now,
				});
			} else {
				ruleRef.current = ruleRef.current.map((ruleStatus, index) => {
					const isRuleStale =
						now - ruleStatus.updatedAt >
						(settings.rules[index]?.staleAfterMs ?? 500);
					return isRuleStale ? initialPoseRuleState() : ruleStatus;
				});

				const staleOverlay =
					now - receivedAt.current >
					Math.max(
						500,
						2000 /
							Math.min(settings.timing.frameLimit, settings.timing.callbackFps),
					);

				const isOverlayStaleOutsideReplay = staleOverlay && mode !== "replay";
				if (isOverlayStaleOutsideReplay) {
					setFrame(null);
					setMasks([]);
				}
			}

			setRuleStatuses([...ruleRef.current]);
		}, 100);
		return () => clearInterval(timer);
	}, [
		frame,
		settings.rules,
		mode,
		paused,
		hidden,
		settings.skeleton.poseIndex,
		settings.timing,
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
	const changeMode = (next: MediaMode) => {
		finishRecording();
		setMode(next);
		setUpload("");
		setPaused(false);
		setPlaying(false);
		setMessage(null);

		const isNextReplayReady = next === "replay" && replay != null;
		if (isNextReplayReady) {
			setPosition(0);
			setTimeout(() => setFrame(readFrameAt(replay, 0)), 0);
		}
	};
	const loadFile = async (
		file: File,
		kind: "media" | "recording" | "config" | "model",
	) => {
		try {
			const isKindSettings = kind === "config";
			if (isKindSettings) {
				const isSettingsOverLimit = file.size > 40000;
				if (isSettingsOverLimit)
					throw new Error("Configuration exceeds 40,000 bytes.");

				setSettings(parseSettings(await file.text()));
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
	const copy = async (stringToCopy: string, success: string) => {
		try {
			await navigator.clipboard.writeText(stringToCopy);
			setMessage(success);
		} catch {
			setMessage(
				"Clipboard unavailable. Select and copy the code, or export the configuration file.",
			);
		}
	};
	const choosePreset = (name: string) => {
		setSettings(readPresetSettings(name));
		const isNameMultiple = name === "multiple";
		setSample(isNameMultiple ? "man-woman-okay.jpg" : "pose.jpg");
		setMode("sample");
		setPaused(false);
		setPlaying(false);
		finishRecording();
	};
	const hasFrame = frame !== null;
	const selected = hasFrame
		? selectPose(frame, settings.skeleton.poseIndex)
		: null;
	const appliedSettings = createSkeletonSettings(settings);
	const joints = { ...appliedSettings.joints };
	settings.rules.forEach((rule, index) => {
		const status = ruleStatuses[index]?.status ?? "unknown";
		const color = {
			pass: rule.passColor,
			fail: rule.failColor,
			unknown: rule.unknownColor,
		}[status];
		joints[rule.vertex] = { ...joints[rule.vertex], color };
	});
	const skeleton = hasFrame
		? createDetectionSkeleton(frame, frame.imageSize, {
				...appliedSettings,
				joints,
			})
		: { points: [], lines: [] };
	const code = generateCode(settings, codeMode, model !== null);
	const duration = replay?.frames.at(-1)?.timestampMs ?? 0;
	const hasMedia = mode === "sample" || mode === "camera" || Boolean(upload);
	return {
		changeMode,
		choosePreset,
		code,
		codeMode,
		config: settings,
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
		recordCount: recordingCount,
		recordRef: recordingRef,
		recordSize: recordingSize,
		recorded,
		recording,
		replay,
		resultTab: reportTab,
		ruleRef,
		ruleStates: ruleStatuses,
		sample,
		selected,
		setCodeMode,
		setConfig: setSettings,
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
		setRecordCount: setRecordingCount,
		setRecording,
		setReplay,
		setResultTab: setReportTab,
		setSample,
		setSpeed,
		setUpload,
		setVideoProgress,
		skeleton,
		sourceHasMedia: hasMedia,
		sourceUrl: mediaUrl,
		speed,
		upload,
		video,
		videoProgress,
	};
};

export type PlaygroundScreen = ReturnType<typeof usePlayground>;
