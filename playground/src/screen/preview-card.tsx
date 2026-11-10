import { initialPoseRuleState } from "expo-mediapipe-pose/core";
import { Range } from "@/controls/range";
import { Select } from "@/controls/select";
import { readFrameAt } from "@/recording";
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

const pickTabLabel = (tab: string) => {
	const isCameraTab = tab === "camera";
	if (isCameraTab) return "Webcam";

	return tab[0]?.toUpperCase() + tab.slice(1);
};

export const PreviewCard = ({
	changeMode,
	config: settings,
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
	sourceHasMedia: hasMedia,
	sourceUrl: mediaUrl,
	speed,
	upload,
	video,
	videoProgress,
}: PreviewCardProps) => {
	const isSampleMode = mode === "sample";
	const isCameraMode = mode === "camera";
	const isPhotoMode = mode === "photo";
	const isVideoMode = mode === "video";
	const isReplayMode = mode === "replay";
	const isNotReplayMode = mode !== "replay";
	const isPhotoOrVideoMode = isPhotoMode || isVideoMode;
	const isStillMode = isSampleMode || isPhotoMode;
	const isMovingMode = isCameraMode || isVideoMode;
	const isMirroredCamera = isCameraMode && mirrored;
	const mediaStageMirrorClass = isMirroredCamera ? "mirrored" : "";
	const fileChoiceLabel = isPhotoMode ? "an image" : "a video";
	const fileAccept = isPhotoMode ? "image/*" : "video/*";
	const imageAltString = isSampleMode
		? "Public MediaPipe evaluation sample"
		: "Your selected local image";
	const videoMediaUrl = isVideoMode ? upload || undefined : undefined;
	const isFrameKnown = frame != null;
	const frameAspectStyle = isFrameKnown
		? { aspectRatio: `${frame.imageSize.width} / ${frame.imageSize.height}` }
		: undefined;
	const isEmptyPreviewShown =
		(!hasMedia && isNotReplayMode) || (isReplayMode && !replay);
	const emptyPreviewTitle = isReplayMode
		? "Bring your landmarks back to life"
		: "Your next test starts here";
	const emptyPreviewMessage = isReplayMode
		? "Import a playground or native landmark recording. No camera pixels are stored."
		: "Choose a local file above. It never leaves this browser.";
	const previewBadgeLabel = isReplayMode ? "LANDMARK REPLAY" : "BROWSER · CPU";
	const pauseButtonLabel = paused ? "Resume" : "Pause";
	const replayButtonLabel = playing ? "Pause replay" : "Play replay";
	const isDurationKnown = Number.isFinite(videoProgress.duration);
	const durationLabel = isDurationKnown
		? videoProgress.duration.toFixed(1)
		: "—";
	return (
		<section className="preview-card">
			<nav className="source-tabs" aria-label="Input source">
				{(["sample", "camera", "photo", "video", "replay"] as const).map(
					(element) => {
						const isTabSelected = mode === element;
						return (
							<button
								type="button"
								key={element}
								aria-pressed={isTabSelected}
								onClick={() => changeMode(element)}
							>
								{pickTabLabel(element)}
							</button>
						);
					},
				)}
			</nav>
			<div className="source-toolbar">
				{isSampleMode && (
					<Select label="Sample scene" value={sample} onChange={setSample}>
						<option value="pose.jpg">Full-body pose</option>
						<option value="man-woman-okay.jpg">Two people</option>
						<option value="burger.jpg">No person · empty result</option>
					</Select>
				)}
				{isCameraMode && (
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
								onChange={(event) => setMirrored(event.target.checked)}
							/>
							Mirror preview
						</label>
					</>
				)}
				{isPhotoOrVideoMode && (
					<label className="file-label">
						Choose {fileChoiceLabel}
						<input
							key={mode}
							type="file"
							accept={fileAccept}
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) void loadFile(file, "media");
							}}
						/>
					</label>
				)}
				{isVideoMode && (
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
				{isReplayMode && (
					<>
						<label className="file-label">
							Import landmark recording
							<input
								type="file"
								accept=".json,application/json"
								onChange={(event) => {
									const file = event.target.files?.[0];
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
									setFrame(readFrameAt(recorded, 0));
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
					className={`media-stage ${mediaStageMirrorClass}`}
					style={frameAspectStyle}
				>
					{isStillMode && mediaUrl && (
						<img
							ref={image}
							key={mediaUrl}
							src={mediaUrl}
							alt={imageAltString}
							onError={() =>
								setMessage(
									"This image could not be decoded. Try a JPEG or PNG.",
								)
							}
						/>
					)}
					{isMovingMode && (
						<video
							ref={video}
							key={mediaUrl || mode}
							src={videoMediaUrl}
							muted
							playsInline
							controls={isVideoMode}
							onTimeUpdate={(event) =>
								setVideoProgress({
									position: event.currentTarget.currentTime,
									duration: event.currentTarget.duration || 0,
								})
							}
							onError={() =>
								setMessage(
									"This video format could not be decoded. Try an H.264 MP4.",
								)
							}
							onSeeked={() => {
								ruleRef.current = settings.rules.map(() =>
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
								mask={masks[settings.skeleton.poseIndex]}
								color={settings.mask.color}
								opacity={settings.mask.opacity}
							/>
							{settings.skeleton.enabled && (
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
				{isEmptyPreviewShown && (
					<div className="empty-preview">
						<span>◎</span>
						<h2>{emptyPreviewTitle}</h2>
						<p>{emptyPreviewMessage}</p>
					</div>
				)}
				<div className="preview-badge">
					<span className="tiny-dot" />
					{previewBadgeLabel}
				</div>
			</div>
			<div className="preview-status">
				<span role="status">
					<span className="tiny-dot" />
					{engine.status}
				</span>
				{isNotReplayMode && (
					<button
						type="button"
						onClick={() => {
							finishRecording();
							setPaused((isPaused) => !isPaused);
						}}
					>
						{pauseButtonLabel}
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
			{isVideoMode && (
				<div className="transport">
					<span>
						{videoProgress.position.toFixed(1)} / {durationLabel} s
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
			{isReplayMode && replay && (
				<div className="transport">
					<button
						type="button"
						disabled={replay.frames.length === 0}
						onClick={() => {
							const isPositionPastDuration = position >= duration;
							if (isPositionPastDuration) setPosition(0);

							setPlaying((isPlaying) => !isPlaying);
						}}
					>
						{replayButtonLabel}
					</button>
					<Range
						label="Replay position (ms)"
						value={position}
						min={0}
						max={duration}
						onChange={(choice) => {
							setPlaying(false);
							setPosition(choice);
							setFrame(readFrameAt(replay, choice));
							ruleRef.current = settings.rules.map(() =>
								initialPoseRuleState(),
							);
						}}
					/>
					<Select
						label="Playback speed"
						value={String(speed)}
						onChange={(amount) => setSpeed(Number(amount))}
					>
						{[0.25, 0.5, 1, 2, 4].map((speed) => (
							<option value={speed} key={speed}>
								{speed}×
							</option>
						))}
					</Select>
				</div>
			)}
		</section>
	);
};
