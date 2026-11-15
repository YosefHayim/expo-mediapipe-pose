import { useEffect, useRef } from "react";
import type { OpenPlaygroundOptions } from "@/landing/open-playground";
import { Inspector } from "./screen/inspector";
import type { IntegrationState } from "./screen/integration-section";
import { MetricsStrip } from "./screen/metrics-row";
import { PreviewCard } from "./screen/preview-card";
import { ReportsCard } from "./screen/results-card";
import { usePlayground } from "./screen/use-playground";

export type PlaygroundRequest = OpenPlaygroundOptions & {
	/** Changes on every request so the same options can be applied again. */
	id: number;
};

type PlaygroundWorkspaceProps = {
	/** Preset and mode asked for by "Try it live" style buttons. */
	request: PlaygroundRequest | null;
	/** Gives the integration section the live code and its controls. */
	onIntegrationChange: (state: IntegrationState) => void;
};

export const PlaygroundWorkspace = ({
	request,
	onIntegrationChange,
}: PlaygroundWorkspaceProps) => {
	const {
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
	} = usePlayground();
	const handleMessageDismissClick = () => setMessage(null);

	const latest = useRef({ changeMode, choosePreset, copy, setCodeMode });
	latest.current = { changeMode, choosePreset, copy, setCodeMode };

	const requestId = request?.id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: Runs once per request id; the handlers come from the latest ref.
	useEffect(() => {
		if (request == null) return;
		const { preset, mode: requestedMode } = request;
		if (preset !== undefined) latest.current.choosePreset(preset);
		if (requestedMode !== undefined) latest.current.changeMode(requestedMode);
	}, [requestId]);

	useEffect(() => {
		onIntegrationChange({
			code,
			codeMode,
			copy: (snippet, success) => latest.current.copy(snippet, success),
			setCodeMode: (next) => latest.current.setCodeMode(next),
		});
	}, [code, codeMode, onIntegrationChange]);

	const hasMessage = message != null && message !== "";
	const hasActualCapture = engine.actualCapture != null;

	return (
		<>
			{hasMessage && (
				<div className="notice" role="status">
					<span>{message}</span>
					<button
						type="button"
						aria-label="Dismiss message"
						onClick={handleMessageDismissClick}
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
					<PreviewCard
						changeMode={changeMode}
						config={settings}
						device={device}
						duration={duration}
						engine={engine}
						finishRecording={finishRecording}
						frame={frame}
						image={image}
						loadFile={loadFile}
						masks={masks}
						mirrored={mirrored}
						mode={mode}
						paused={paused}
						playing={playing}
						position={position}
						recorded={recorded}
						replay={replay}
						ruleRef={ruleRef}
						sample={sample}
						setDevice={setDevice}
						setFrame={setFrame}
						setMasks={setMasks}
						setMessage={setMessage}
						setMirrored={setMirrored}
						setPaused={setPaused}
						setPlaying={setPlaying}
						setPosition={setPosition}
						setReplay={setReplay}
						setSample={setSample}
						setSpeed={setSpeed}
						setUpload={setUpload}
						setVideoProgress={setVideoProgress}
						skeleton={skeleton}
						sourceHasMedia={hasMedia}
						sourceUrl={mediaUrl}
						speed={speed}
						upload={upload}
						video={video}
						videoProgress={videoProgress}
					/>
					<MetricsStrip engine={engine} frame={frame} />
					{hasActualCapture && (
						<p className="caption">{engine.actualCapture}</p>
					)}
					<ReportsCard
						choosePreset={choosePreset}
						config={settings}
						finishRecording={finishRecording}
						frame={frame}
						mode={mode}
						paused={paused}
						recordCount={recordingCount}
						recordRef={recordingRef}
						recordSize={recordingSize}
						recorded={recorded}
						recording={recording}
						resultTab={reportTab}
						ruleStates={ruleStatuses}
						selected={selected}
						setRecordCount={setRecordingCount}
						setRecording={setRecording}
						setResultTab={setReportTab}
					/>
					<p className="browser-note">
						<strong>A browser preview, a native library.</strong> This
						playground uses MediaPipe for the web and the library’s core
						helpers. Phone camera alignment, native masks, thermal behavior, and
						sustained performance need testing in an iOS/Android development
						build.
					</p>
				</div>
				<Inspector
					choosePreset={choosePreset}
					config={settings}
					copy={copy}
					loadFile={loadFile}
					modelName={modelName}
					setConfig={setSettings}
					setMessage={setMessage}
					setModel={setModel}
					setModelName={setModelName}
				/>
			</section>
		</>
	);
};
