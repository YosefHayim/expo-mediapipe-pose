import { Inspector } from "./screen/inspector";
import { IntegrationSection } from "./screen/integration-section";
import { IntroSection } from "./screen/intro-section";
import { MetricsStrip } from "./screen/metrics-row";
import { PreviewCard } from "./screen/preview-card";
import { ReportsCard } from "./screen/results-card";
import { SiteFooter } from "./screen/site-footer";
import { SiteHeader } from "./screen/site-header";
import { usePlayground } from "./screen/use-playground";

export const App = () => {
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
	return (
		<>
			<a className="skip-link" href="#workspace">
				Skip to playground
			</a>
			<SiteHeader />
			<main>
				<IntroSection />
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
						{engine.actualCapture && (
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
							helpers. Phone camera alignment, native masks, thermal behavior,
							and sustained performance need testing in an iOS/Android
							development build.
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
				<IntegrationSection
					code={code}
					codeMode={codeMode}
					copy={copy}
					setCodeMode={setCodeMode}
				/>
			</main>
			<SiteFooter />
		</>
	);
};
