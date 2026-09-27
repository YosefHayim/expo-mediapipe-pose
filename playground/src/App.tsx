import {
	createDetectionSkeleton,
	initialPoseRuleState,
	LANDMARK_NAMES,
	type PoseRuleState,
	selectPose,
} from "expo-mediapipe-pose/core";
import { useEffect, useRef, useState } from "react";
import { Controls, Range, Select } from "./Controls";
import { generateCode, skeletonOptions } from "./codegen";
import {
	type Config,
	configurationLink,
	defaults,
	parseConfig,
	preset,
} from "./config";
import {
	download,
	frameAt,
	MAX_RECORDING_FRAMES,
	parseRecording,
	type Recording,
} from "./recording";
import { measureRule, updateRules } from "./rules";
import type { BrowserFrame, BrowserMask, SourceMode } from "./types";
import { useInference } from "./useInference";

const base = import.meta.env.BASE_URL;
const repository = "https://github.com/YosefHayim/expo-mediapipe-pose";
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
export default function App() {
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
	const recordSize = useRef(0);
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
	function finishRecording() {
		setRecording(false);
		if (recordRef.current.length)
			setRecorded({
				format: "pose-playground",
				version: 1,
				frames: [...recordRef.current],
			});
	}
	function acceptFrame(next: BrowserFrame, nextMasks: BrowserMask[]) {
		receivedAt.current = performance.now();
		setFrame(next);
		setMasks(nextMasks);
		if (!recording) return;
		const now = performance.now();
		if (recordRef.current.length === 0) recordStart.current = now;
		const entry = { timestampMs: now - recordStart.current, frame: next };
		const size = JSON.stringify(entry).length;
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
	return (
		<>
			<a className="skip-link" href="#workspace">
				Skip to playground
			</a>
			<header className="site-header">
				<a className="brand" href={base}>
					<span className="brand-mark">
						p<span>•</span>
					</span>
					<span>
						pose<span className="brand-light"> / playground</span>
					</span>
				</a>
				<nav aria-label="Resources">
					<a
						href={`${repository}/blob/main/docs/api.md`}
						target="_blank"
						rel="noreferrer"
					>
						API reference ↗
					</a>
					<a href={repository} target="_blank" rel="noreferrer">
						GitHub ↗
					</a>
				</nav>
			</header>
			<main>
				<section className="intro">
					<div>
						<p className="eyebrow">EXPO MEDIAPIPE POSE · INTERACTIVE LAB</p>
						<h1>
							Your movement.
							<br />
							<span>Your configuration.</span>
						</h1>
						<p className="intro-copy">
							See what pose detection can do for your idea. Try a sample, make
							it yours, then take the code into Expo.
						</p>
					</div>
					<div className="intro-note">
						<span className="tiny-dot" /> Runs in your browser
						<p>
							Your camera and files stay on your device.
							<br />
							No account. No upload. Just try it.
						</p>
						<a href="#integration">Ready to build? Get the code ↓</a>
					</div>
				</section>
				<ol className="journey">
					<li>
						<span>01</span> Choose your input
					</li>
					<li>
						<span>02</span> Make it yours
					</li>
					<li>
						<span>03</span> Take it to Expo
					</li>
				</ol>
				{message && (
					<div className="notice" role="status">
						<span>{message}</span>
						<button
							type="button"
							aria-label="Dismiss message"
							onClick={() => setMessage(null)}
						>
							×
						</button>
					</div>
				)}
				<section
					className="workspace"
					id="workspace"
					aria-label="Pose playground"
				>
					<div className="preview-column">
						<section className="preview-card">
							<nav className="source-tabs" aria-label="Input source">
								{(
									["sample", "camera", "photo", "video", "replay"] as const
								).map((item) => (
									<button
										type="button"
										key={item}
										aria-pressed={mode === item}
										onClick={() => changeMode(item)}
									>
										{item === "camera"
											? "Webcam"
											: item[0]?.toUpperCase() + item.slice(1)}
									</button>
								))}
							</nav>
							<div className="source-toolbar">
								{mode === "sample" && (
									<Select
										label="Sample scene"
										value={sample}
										onChange={setSample}
									>
										<option value="pose.jpg">Full-body pose</option>
										<option value="man-woman-okay.jpg">Two people</option>
										<option value="burger.jpg">No person · empty result</option>
									</Select>
								)}
								{mode === "camera" && (
									<>
										<Select
											label="Browser camera"
											value={device}
											onChange={setDevice}
										>
											<option value="">Default camera</option>
											{engine.devices.map((camera, i) => (
												<option key={camera.deviceId} value={camera.deviceId}>
													{camera.label || `Camera ${i + 1}`}
												</option>
											))}
										</Select>
										<label className="toggle">
											<input
												type="checkbox"
												checked={mirrored}
												onChange={(e) => setMirrored(e.target.checked)}
											/>
											Mirror preview
										</label>
									</>
								)}
								{(mode === "photo" || mode === "video") && (
									<label className="file-label">
										Choose {mode === "photo" ? "an image" : "a video"}
										<input
											key={mode}
											type="file"
											accept={mode === "photo" ? "image/*" : "video/*"}
											onChange={(e) => {
												const file = e.target.files?.[0];
												if (file) void loadFile(file, "media");
											}}
										/>
									</label>
								)}
								{mode === "video" && (
									<button
										type="button"
										onClick={() => {
											setUpload(`${base}pose-video.mp4`);
											setPaused(false);
										}}
									>
										Try sample video
									</button>
								)}
								{mode === "replay" && (
									<>
										<label className="file-label">
											Import landmark recording
											<input
												type="file"
												accept=".json,application/json"
												onChange={(e) => {
													const file = e.target.files?.[0];
													if (file) void loadFile(file, "recording");
												}}
											/>
										</label>
										{recorded && (
											<button
												type="button"
												onClick={() => {
													setReplay(recorded);
													setPosition(0);
													setFrame(frameAt(recorded, 0));
												}}
											>
												Use last recording
											</button>
										)}
									</>
								)}
							</div>
							<div className="viewport">
								<div
									className={`media-stage ${mode === "camera" && mirrored ? "mirrored" : ""}`}
									style={
										frame
											? {
													aspectRatio: `${frame.imageSize.width} / ${frame.imageSize.height}`,
												}
											: undefined
									}
								>
									{(mode === "sample" || mode === "photo") && sourceUrl && (
										<img
											ref={image}
											key={sourceUrl}
											src={sourceUrl}
											alt={
												mode === "sample"
													? "Public MediaPipe evaluation sample"
													: "Your selected local image"
											}
											onError={() =>
												setMessage(
													"This image could not be decoded. Try a JPEG or PNG.",
												)
											}
										/>
									)}
									{(mode === "camera" || mode === "video") && (
										<video
											ref={video}
											key={sourceUrl || mode}
											src={mode === "video" && upload ? upload : undefined}
											muted
											playsInline
											controls={mode === "video"}
											onTimeUpdate={(e) =>
												setVideoProgress({
													position: e.currentTarget.currentTime,
													duration: e.currentTarget.duration || 0,
												})
											}
											onError={() =>
												setMessage(
													"This video format could not be decoded. Try an H.264 MP4.",
												)
											}
											onSeeked={() => {
												ruleRef.current = config.rules.map(() =>
													initialPoseRuleState(),
												);
												setFrame(null);
												setMasks([]);
											}}
										/>
									)}
									{frame && (
										<>
											<MaskCanvas
												mask={masks[config.skeleton.poseIndex]}
												color={config.mask.color}
												opacity={config.mask.opacity}
											/>
											{config.skeleton.enabled && (
												<svg
													className="skeleton"
													viewBox={`0 0 ${frame.imageSize.width} ${frame.imageSize.height}`}
													role="img"
													aria-label={`Skeleton overlay: ${skeleton.points.length} visible landmarks`}
												>
													{skeleton.lines.map((line) => (
														<line
															key={line.name}
															x1={line.start.x}
															y1={line.start.y}
															x2={line.end.x}
															y2={line.end.y}
															stroke={line.color}
															strokeWidth={line.width}
															strokeLinecap="round"
														/>
													))}
													{skeleton.points.map((point) => (
														<circle
															key={point.name}
															cx={point.x}
															cy={point.y}
															r={point.radius}
															fill={point.color}
														>
															<title>{point.name}</title>
														</circle>
													))}
												</svg>
											)}
										</>
									)}
								</div>
								{((!sourceHasMedia && mode !== "replay") ||
									(mode === "replay" && !replay)) && (
									<div className="empty-preview">
										<span>◎</span>
										<h2>
											{mode === "replay"
												? "Bring your landmarks back to life"
												: "Your next test starts here"}
										</h2>
										<p>
											{mode === "replay"
												? "Import a playground or native landmark recording. No camera pixels are stored."
												: "Choose a local file above. It never leaves this browser."}
										</p>
									</div>
								)}
								<div className="preview-badge">
									<span className="tiny-dot" />
									{mode === "replay" ? "LANDMARK REPLAY" : "BROWSER · CPU"}
								</div>
							</div>
							<div className="preview-status">
								<span role="status">
									<span className="tiny-dot" />
									{engine.status}
								</span>
								{mode !== "replay" && (
									<button
										type="button"
										onClick={() => {
											finishRecording();
											setPaused((value) => !value);
										}}
									>
										{paused ? "Resume" : "Pause"}
									</button>
								)}
							</div>
							{engine.error && (
								<div role="alert" className="error-box">
									<strong>We couldn’t start this test.</strong>
									<p>{engine.error}</p>
									<button type="button" onClick={engine.retry}>
										Retry
									</button>
									<button type="button" onClick={() => changeMode("sample")}>
										Use a sample
									</button>
								</div>
							)}
							{mode === "video" && (
								<div className="transport">
									<span>
										{videoProgress.position.toFixed(1)} /{" "}
										{Number.isFinite(videoProgress.duration)
											? videoProgress.duration.toFixed(1)
											: "—"}{" "}
										s
									</span>
									<small>
										Press play to sample at the inference limit. Sampling
										follows playback; frames may be skipped.
									</small>
									<button
										type="button"
										onClick={() => {
											finishRecording();
											setPaused(true);
										}}
									>
										Cancel analysis
									</button>
								</div>
							)}
							{mode === "replay" && replay && (
								<div className="transport">
									<button
										type="button"
										disabled={replay.frames.length === 0}
										onClick={() => {
											if (position >= duration) setPosition(0);
											setPlaying((value) => !value);
										}}
									>
										{playing ? "Pause replay" : "Play replay"}
									</button>
									<Range
										label="Replay position (ms)"
										value={position}
										min={0}
										max={duration}
										onChange={(value) => {
											setPlaying(false);
											setPosition(value);
											setFrame(frameAt(replay, value));
											ruleRef.current = config.rules.map(() =>
												initialPoseRuleState(),
											);
										}}
									/>
									<Select
										label="Playback speed"
										value={String(speed)}
										onChange={(value) => setSpeed(Number(value))}
									>
										{[0.25, 0.5, 1, 2, 4].map((value) => (
											<option value={value} key={value}>
												{value}×
											</option>
										))}
									</Select>
								</div>
							)}
						</section>
						<div className="metrics">
							<Metric
								label="Poses detected"
								value={frame ? String(frame.poses.length) : "—"}
							/>
							<Metric
								label="Inference time"
								value={
									frame ? `${frame.inferenceDurationMs.toFixed(0)} ms` : "—"
								}
							/>
							<Metric
								label="Inference / result FPS"
								value={
									engine.cadence.inference
										? `${engine.cadence.inference.toFixed(1)} / ${engine.cadence.results.toFixed(1)}`
										: "—"
								}
							/>
						</div>
						{engine.actualCapture && (
							<p className="caption">{engine.actualCapture}</p>
						)}
						<section className="results-card">
							<div className="section-heading">
								<h2>Inside the detection</h2>
								<span className="tag">LIVE RESULTS</span>
							</div>
							<div className="result-tabs">
								{["feedback", "landmarks", "record"].map((tab) => (
									<button
										type="button"
										key={tab}
										aria-pressed={resultTab === tab}
										onClick={() => setResultTab(tab)}
									>
										{tab[0]?.toUpperCase() + tab.slice(1)}
									</button>
								))}
							</div>
							{resultTab === "feedback" && (
								<div className="result-body">
									{config.rules.length === 0 ? (
										<>
											<h3>What does your app need to notice?</h3>
											<p>
												Add a rule to measure an angle, distance, or relative
												height. Try the arm-feedback preset to see independent
												joint colors.
											</p>
											<button
												type="button"
												onClick={() => choosePreset("arms")}
											>
												Try arm feedback ↗
											</button>
										</>
									) : (
										config.rules.map((rule, index) => {
											const measurement = selected
												? measureRule(selected, rule)
												: { value: null, unit: "" };
											const state = ruleStates[index]?.status ?? "unknown";
											return (
												<div className="rule-result" key={rule.id}>
													<div>
														<strong>
															Rule {index + 1} · {rule.kind}
														</strong>
														<small>
															{rule.vertex} ·{" "}
															{measurement.value?.toFixed(1) ?? "—"}{" "}
															{measurement.unit}
														</small>
													</div>
													<span className={`status-pill ${state}`}>
														{state}
													</span>
												</div>
											);
										})
									)}
									<small>
										Static images hold their measurement while displayed. Pixel
										thresholds depend on inference dimensions; retune them on
										your device. World distances are model estimates, not
										calibrated measurements.
									</small>
								</div>
							)}
							{resultTab === "landmarks" && (
								<div className="landmark-table">
									<table>
										<caption>
											Selected pose {config.skeleton.poseIndex} · normalized
											image coordinates · raw data is preserved
										</caption>
										<thead>
											<tr>
												<th>Landmark</th>
												<th>x</th>
												<th>y</th>
												<th>z</th>
												<th>Visibility</th>
											</tr>
										</thead>
										<tbody>
											{LANDMARK_NAMES.map((name, i) => (
												<tr key={name}>
													<th>{name}</th>
													{(["x", "y", "z", "visibility"] as const).map(
														(key) => (
															<td key={key}>
																{selected?.landmarks[i]?.[key]?.toFixed(3) ??
																	"—"}
															</td>
														),
													)}
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
							{resultTab === "record" && (
								<div className="result-body">
									<h3>Save the landmarks. Leave the pixels.</h3>
									<p>
										Record up to 1,800 frames / 15 MiB. Exports use the
										playground format; native recordings can also be imported
										for replay.
									</p>
									<div className="actions">
										<button
											type="button"
											disabled={mode === "replay" || !frame || paused}
											onClick={() => {
												if (recording) {
													finishRecording();
													return;
												}
												recordRef.current = [];
												recordSize.current = 0;
												setRecordCount(0);
												setRecording(true);
											}}
										>
											{" "}
											{recording ? "Stop recording" : "Record landmarks"}
										</button>
										{recorded && (
											<button
												type="button"
												onClick={() =>
													download(
														"pose-recording.json",
														JSON.stringify(recorded),
													)
												}
											>
												Download recording
											</button>
										)}
									</div>
									<p aria-live="polite">
										{recordCount} frames captured
										{recording ? " · recording" : ""}
									</p>
								</div>
							)}
						</section>
						<p className="browser-note">
							<strong>A browser preview, a native library.</strong> This
							playground uses MediaPipe for the web and the library’s core
							helpers. Phone camera alignment, native masks, thermal behavior,
							and sustained performance need testing in an iOS/Android
							development build.
						</p>
					</div>
					<aside className="inspector" aria-label="Configuration">
						<div className="inspector-heading">
							<div>
								<p className="eyebrow">MAKE IT YOURS</p>
								<h2>Configuration</h2>
							</div>
							<button
								type="button"
								className="text-button"
								onClick={() => {
									setConfig(defaults());
									setModel(null);
									setModelName("");
									setMessage("Restored documented library defaults.");
								}}
							>
								Reset
							</button>
						</div>
						<div className="presets">
							<p>Start with a use case</p>
							<div className="preset-grid">
								<button type="button" onClick={() => choosePreset("full")}>
									◎ <span>Full body</span>
								</button>
								<button type="button" onClick={() => choosePreset("arms")}>
									⌁ <span>Arm feedback</span>
								</button>
								<button type="button" onClick={() => choosePreset("multiple")}>
									◉ <span>Multiple poses</span>
								</button>
								<button type="button" onClick={() => choosePreset("mask")}>
									◐ <span>Segmentation</span>
								</button>
							</div>
						</div>
						{modelName && (
							<p className="model-note">
								Local model: {modelName}
								<button
									type="button"
									onClick={() => {
										setModel(null);
										setModelName("");
									}}
								>
									Clear
								</button>
							</p>
						)}
						<Controls
							config={config}
							setConfig={setConfig}
							onModel={(file) => void loadFile(file, "model")}
						/>
						<div className="config-actions">
							<button
								type="button"
								onClick={() =>
									void copy(
										configurationLink(config),
										"Configuration link copied. Media and model files are not included.",
									)
								}
							>
								Copy share link ↗
							</button>
							<button
								type="button"
								onClick={() =>
									download("pose-config.json", JSON.stringify(config, null, 2))
								}
							>
								Export JSON
							</button>
							<label className="file-label">
								Import configuration
								<input
									type="file"
									accept=".json,application/json"
									onChange={(e) => {
										const file = e.target.files?.[0];
										if (file) void loadFile(file, "config");
									}}
								/>
							</label>
						</div>
					</aside>
				</section>
				<section id="integration" className="integration">
					<div className="integration-copy">
						<p className="eyebrow">FROM EXPERIMENT TO APP</p>
						<h2>
							Keep what works.
							<br />
							Take the code.
						</h2>
						<p>
							Your configuration, translated into the native Expo API. Choose
							the integration you need.
						</p>
						<Select
							label="Integration type"
							value={codeMode}
							onChange={(value) => setCodeMode(value as SourceMode)}
						>
							<option value="camera">Live camera + feedback rules</option>
							<option value="photo">Local photo analysis</option>
							<option value="video">Local video analysis</option>
						</Select>
						<button
							type="button"
							className="primary"
							onClick={() => void copy(code, "Expo integration code copied.")}
						>
							Copy Expo code ↗
						</button>
						<p className="caption">
							Requires an iOS/Android development build; Expo Go cannot load
							this module. Local models need a phone-local path.
						</p>
						<a
							href={`${repository}/blob/main/docs/guides/expo-pose-detection.md`}
						>
							Installation & permission guide ↗
						</a>
						<p className="caption">
							Photo/video snippets expose a consumer callback for your renderer
							and safely release masks. Camera rules and styles appear in the
							camera snippet.
						</p>
					</div>
					<div className="code-panel">
						<div>
							<span>expo-mediapipe-pose · 0.3.0</span>
							<span>TypeScript</span>
						</div>
						{/* biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable code must be keyboard accessible. */}
						<pre tabIndex={0}>
							<code>{code}</code>
						</pre>
					</div>
				</section>
			</main>
			<footer>
				<span>expo-mediapipe-pose · Community-maintained</span>
				<div>
					<a href={`${base}THIRD_PARTY_NOTICES.md`}>
						MediaPipe & sample attribution
					</a>
					<a href={`${base}version.json`}>Build information</a>
				</div>
			</footer>
		</>
	);
}
function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
}
function MaskCanvas({
	mask,
	color,
	opacity,
}: {
	mask: BrowserMask | undefined;
	color: string;
	opacity: number;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		if (!mask || !ref.current) return;
		const canvas = ref.current;
		canvas.width = mask.width;
		canvas.height = mask.height;
		const context = canvas.getContext("2d");
		if (!context) return;
		const pixels = context.createImageData(mask.width, mask.height);
		const rgb = [1, 3, 5].map((offset) =>
			Number.parseInt(color.slice(offset, offset + 2), 16),
		);
		mask.values.forEach((value, index) => {
			pixels.data[index * 4] = rgb[0] ?? 0;
			pixels.data[index * 4 + 1] = rgb[1] ?? 0;
			pixels.data[index * 4 + 2] = rgb[2] ?? 0;
			pixels.data[index * 4 + 3] = value;
		});
		context.putImageData(pixels, 0, 0);
	}, [mask, color]);
	return mask ? (
		<canvas
			ref={ref}
			className="mask"
			style={{ opacity }}
			aria-label="Selected pose segmentation mask"
		/>
	) : null;
}
