import libraryPackage from "expo-mediapipe-pose/package.json";
import { CopyIcon } from "@/landing/icons/icons";
import { Section } from "@/landing/section/section";
import { Select } from "@/playground/controls/select";
import type { MediaMode } from "@/playground/types";
import type { PlaygroundScreen } from "./use-playground";

export type IntegrationState = Pick<
	PlaygroundScreen,
	"code" | "codeMode" | "copy" | "setCodeMode"
>;

export const IntegrationSection = ({
	code,
	codeMode,
	copy,
	setCodeMode,
}: IntegrationState) => {
	const handleCodeModeChange = (mode: MediaMode) => setCodeMode(mode);

	const handleCodeCopyClick = () =>
		void copy(code, "Expo integration code copied.");

	return (
		<Section
			id="integration"
			ground="paper"
			title="Keep what works. Take the code."
			intro="Your configuration, translated into the native Expo API. Choose the integration you need."
		>
			<div className="integration">
				<div className="integration-copy">
					<Select
						label="Integration type"
						value={codeMode}
						onChange={handleCodeModeChange}
					>
						<option value="camera">Live camera + feedback rules</option>
						<option value="photo">Local photo analysis</option>
						<option value="video">Local video analysis</option>
					</Select>
					<button
						type="button"
						className="button-primary"
						onClick={handleCodeCopyClick}
					>
						Copy Expo code
						<CopyIcon size={18} />
					</button>
					<p className="caption">
						Requires an iOS/Android development build; Expo Go cannot load this
						module. Local models need a phone-local path.
					</p>
					<p className="caption">
						Photo/video snippets expose a consumer callback for your renderer
						and safely release masks. Camera rules and styles appear in the
						camera snippet.
					</p>
				</div>
				<div className="code-panel">
					<div>
						<span>expo-mediapipe-pose · {libraryPackage.version}</span>
						<span>TypeScript</span>
					</div>
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: Scrollable code must be keyboard accessible. */}
					<pre tabIndex={0}>
						<code>{code}</code>
					</pre>
				</div>
			</div>
		</Section>
	);
};
