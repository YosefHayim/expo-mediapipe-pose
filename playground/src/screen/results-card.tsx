import { LANDMARK_NAMES } from "expo-mediapipe-pose/core";
import { download, RECORDING_ENVELOPE_BYTES } from "@/recording";
import { measureRule } from "@/rules";
import { TabButton } from "./tab-button";
import type { PlaygroundScreen } from "./use-playground";

type ReportsCardProps = Pick<
	PlaygroundScreen,
	| "choosePreset"
	| "config"
	| "finishRecording"
	| "frame"
	| "mode"
	| "paused"
	| "recordCount"
	| "recordRef"
	| "recordSize"
	| "recorded"
	| "recording"
	| "resultTab"
	| "ruleStates"
	| "selected"
	| "setRecordCount"
	| "setRecording"
	| "setResultTab"
>;

export const ReportsCard = ({
	choosePreset,
	config: settings,
	finishRecording,
	frame,
	mode,
	paused,
	recordCount: recordingCount,
	recordRef: recordingRef,
	recordSize: recordingSize,
	recorded,
	recording,
	resultTab: reportTab,
	ruleStates: ruleStatuses,
	selected,
	setRecordCount: setRecordingCount,
	setRecording,
	setResultTab: setReportTab,
}: ReportsCardProps) => {
	const isFeedbackTab = reportTab === "feedback";
	const isLandmarksTab = reportTab === "landmarks";
	const isRecordingTab = reportTab === "record";
	const isRuleListEmpty = settings.rules.length === 0;

	const handleArmsPresetClick = () => choosePreset("arms");

	const handleRecordingToggleClick = () => {
		if (recording) {
			finishRecording();
			return;
		}

		recordingRef.current = [];
		recordingSize.current = RECORDING_ENVELOPE_BYTES;
		setRecordingCount(0);
		setRecording(true);
	};

	const handleRecordingDownloadClick = () =>
		download("pose-recording.json", JSON.stringify(recorded));

	return (
		<section className="results-card">
			<div className="section-heading">
				<h2>Inside the detection</h2>
				<span className="tag">LIVE RESULTS</span>
			</div>
			<div className="result-tabs">
				{(["feedback", "landmarks", "record"] as const).map((tab) => (
					<TabButton
						key={tab}
						tab={tab}
						label={tab[0]?.toUpperCase() + tab.slice(1)}
						isSelected={reportTab === tab}
						onSelect={setReportTab}
					/>
				))}
			</div>
			{isFeedbackTab && (
				<div className="result-body">
					{isRuleListEmpty ? (
						<>
							<h3>What does your app need to notice?</h3>
							<p>
								Add a rule to measure an angle, distance, or relative height.
								Try the arm-feedback preset to see independent joint colors.
							</p>
							<button type="button" onClick={handleArmsPresetClick}>
								Try arm feedback ↗
							</button>
						</>
					) : (
						settings.rules.map((rule, index) => {
							const hasSelection = selected !== null;
							const measurement = hasSelection
								? measureRule(selected, rule)
								: { value: null, unit: "" };
							const ruleStatus = ruleStatuses[index]?.status ?? "unknown";
							return (
								<div className="rule-result" key={rule.id}>
									<div>
										<strong>
											Rule {index + 1} · {rule.kind}
										</strong>
										<small>
											{rule.vertex} · {measurement.value?.toFixed(1) ?? "—"}{" "}
											{measurement.unit}
										</small>
									</div>
									<span className={`status-pill ${ruleStatus}`}>
										{ruleStatus}
									</span>
								</div>
							);
						})
					)}
					<small>
						Static images hold their measurement while displayed. Pixel
						thresholds depend on inference dimensions; retune them on your
						device. World distances are model estimates, not calibrated
						measurements.
					</small>
				</div>
			)}
			{isLandmarksTab && (
				<div className="landmark-table">
					<table>
						<caption>
							Selected pose {settings.skeleton.poseIndex} · normalized image
							coordinates · raw data is preserved
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
									{(["x", "y", "z", "visibility"] as const).map((key) => (
										<td key={key}>
											{selected?.landmarks[i]?.[key]?.toFixed(3) ?? "—"}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			{isRecordingTab && (
				<div className="result-body">
					<h3>Save the landmarks. Leave the pixels.</h3>
					<p>
						Record up to 1,800 frames / 15 MiB. Exports use the playground
						format; native recordings can also be imported for replay.
					</p>
					<div className="actions">
						<button
							type="button"
							disabled={mode === "replay" || !frame || paused}
							onClick={handleRecordingToggleClick}
						>
							{" "}
							{recording ? "Stop recording" : "Record landmarks"}
						</button>
						{recorded && (
							<button type="button" onClick={handleRecordingDownloadClick}>
								Download recording
							</button>
						)}
					</div>
					<p aria-live="polite">
						{recordingCount} frames captured
						{recording ? " · recording" : ""}
					</p>
				</div>
			)}
		</section>
	);
};
