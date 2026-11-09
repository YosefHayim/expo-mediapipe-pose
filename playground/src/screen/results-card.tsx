import { LANDMARK_NAMES } from "expo-mediapipe-pose/core";
import { download, RECORDING_ENVELOPE_BYTES } from "@/recording";
import { measureRule } from "@/rules";
import type { PlaygroundScreen } from "./use-playground";

type ResultsCardProps = Pick<
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

export const ResultsCard = ({
	choosePreset,
	config,
	finishRecording,
	frame,
	mode,
	paused,
	recordCount,
	recordRef,
	recordSize,
	recorded,
	recording,
	resultTab,
	ruleStates,
	selected,
	setRecordCount,
	setRecording,
	setResultTab,
}: ResultsCardProps) => {
	return (
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
								Add a rule to measure an angle, distance, or relative height.
								Try the arm-feedback preset to see independent joint colors.
							</p>
							<button type="button" onClick={() => choosePreset("arms")}>
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
											{rule.vertex} · {measurement.value?.toFixed(1) ?? "—"}{" "}
											{measurement.unit}
										</small>
									</div>
									<span className={`status-pill ${state}`}>{state}</span>
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
			{resultTab === "landmarks" && (
				<div className="landmark-table">
					<table>
						<caption>
							Selected pose {config.skeleton.poseIndex} · normalized image
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
			{resultTab === "record" && (
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
							onClick={() => {
								if (recording) {
									finishRecording();
									return;
								}
								recordRef.current = [];
								recordSize.current = RECORDING_ENVELOPE_BYTES;
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
									download("pose-recording.json", JSON.stringify(recorded))
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
	);
};
