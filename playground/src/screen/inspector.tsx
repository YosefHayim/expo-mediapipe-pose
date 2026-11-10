import { createConfigurationLink, createDefaultSettings } from "@/config";
import { Controls } from "@/controls/controls";
import { download } from "@/recording";
import type { PlaygroundScreen } from "./use-playground";

type InspectorProps = Pick<
	PlaygroundScreen,
	| "choosePreset"
	| "config"
	| "copy"
	| "loadFile"
	| "modelName"
	| "setConfig"
	| "setMessage"
	| "setModel"
	| "setModelName"
>;

export const Inspector = ({
	choosePreset,
	config,
	copy,
	loadFile,
	modelName,
	setConfig,
	setMessage,
	setModel,
	setModelName,
}: InspectorProps) => {
	return (
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
						setConfig(createDefaultSettings());
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
							createConfigurationLink(config),
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
	);
};
