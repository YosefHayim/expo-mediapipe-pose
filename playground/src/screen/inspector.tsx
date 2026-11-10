import type { ChangeEvent } from "react";
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
	config: settings,
	copy,
	loadFile,
	modelName,
	setConfig: setSettings,
	setMessage,
	setModel,
	setModelName,
}: InspectorProps) => {
	const handleSettingsResetClick = () => {
		setSettings(createDefaultSettings());
		setModel(null);
		setModelName("");
		setMessage("Restored documented library defaults.");
	};

	const handleFullPresetClick = () => choosePreset("full");

	const handleArmsPresetClick = () => choosePreset("arms");

	const handleMultiplePresetClick = () => choosePreset("multiple");

	const handleMaskPresetClick = () => choosePreset("mask");

	const handleModelClearClick = () => {
		setModel(null);
		setModelName("");
	};

	const handleModelFileChange = (file: File) => void loadFile(file, "model");

	const handleConfigLinkCopyClick = () =>
		void copy(
			createConfigurationLink(settings),
			"Configuration link copied. Media and model files are not included.",
		);

	const handleConfigDownloadClick = () =>
		download("pose-config.json", JSON.stringify(settings, null, 2));

	const handleConfigFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) void loadFile(file, "config");
	};

	const hasModelName = modelName !== "";

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
					onClick={handleSettingsResetClick}
				>
					Reset
				</button>
			</div>
			<div className="presets">
				<p>Start with a use case</p>
				<div className="preset-grid">
					<button type="button" onClick={handleFullPresetClick}>
						◎ <span>Full body</span>
					</button>
					<button type="button" onClick={handleArmsPresetClick}>
						⌁ <span>Arm feedback</span>
					</button>
					<button type="button" onClick={handleMultiplePresetClick}>
						◉ <span>Multiple poses</span>
					</button>
					<button type="button" onClick={handleMaskPresetClick}>
						◐ <span>Segmentation</span>
					</button>
				</div>
			</div>
			{hasModelName && (
				<p className="model-note">
					Local model: {modelName}
					<button type="button" onClick={handleModelClearClick}>
						Clear
					</button>
				</p>
			)}
			<Controls
				config={settings}
				setConfig={setSettings}
				onModel={handleModelFileChange}
			/>
			<div className="config-actions">
				<button type="button" onClick={handleConfigLinkCopyClick}>
					Copy share link ↗
				</button>
				<button type="button" onClick={handleConfigDownloadClick}>
					Export JSON
				</button>
				<label className="file-label">
					Import configuration
					<input
						type="file"
						accept=".json,application/json"
						onChange={handleConfigFileChange}
					/>
				</label>
			</div>
		</aside>
	);
};
