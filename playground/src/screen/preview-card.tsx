import { initialPoseRuleState } from "expo-mediapipe-pose/core";
import { Range } from "@/controls/range";
import { Select } from "@/controls/select";
import { frameAt } from "@/recording";
import { base } from "@/site";
import { MaskCanvas } from "./mask-canvas";
import type { PlaygroundScreen } from "./use-playground";

type PreviewCardProps = Pick<
	PlaygroundScreen,
	| "changeMode"
	| "config"
	| "device"
	| "duration"
	| "engine"
	| "finishRecording"
	| "frame"
	| "image"
	| "loadFile"
	| "masks"
	| "mirrored"
	| "mode"
	| "paused"
	| "playing"
	| "position"
	| "recorded"
	| "replay"
	| "ruleRef"
	| "sample"
	| "setDevice"
	| "setFrame"
	| "setMasks"
	| "setMessage"
	| "setMirrored"
	| "setPaused"
	| "setPlaying"
	| "setPosition"
	| "setReplay"
	| "setSample"
	| "setSpeed"
	| "setUpload"
	| "setVideoProgress"
	| "skeleton"
	| "sourceHasMedia"
	| "sourceUrl"
	| "speed"
	| "upload"
	| "video"
	| "videoProgress"
>;

export const PreviewCard = ({
	changeMode,
	config,
	device,
	duration,
	engine,
	finishRecording,
	frame,
	image,
	loadFile,
	masks,
	mirrored,
	mode,
	paused,
	playing,
	position,
	recorded,
	replay,
	ruleRef,
	sample,
	setDevice,
	setFrame,
	setMasks,
	setMessage,
	setMirrored,
	setPaused,
	setPlaying,
	setPosition,
	setReplay,
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
}: PreviewCardProps) => {
	return (
		<section className="preview-card">
			<nav className="source-tabs" aria-label="Input source">
				{(["sample", "camera", "photo", "video", "replay"] as const).map(
					(item) => (
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
					),
				)}
			</nav>
			<div className="source-toolbar">
				{mode === "sample" && (
					<Select label="Sample scene" value={sample} onChange={setSample}>
						<option value="pose.jpg">Full-body pose</option>
						<option value="man-woman-okay.jpg">Two people</option>
						<option value="burger.jpg">No person · empty result</option>
					</Select>
				)}
				{mode === "camera" && (
					<>
						<Select label="Browser camera" value={device} onChange={setDevice}>
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
						Press play to sample at the inference limit. Sampling follows
						playback; frames may be skipped.
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
							ruleRef.current = config.rules.map(() => initialPoseRuleState());
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
	);
};
