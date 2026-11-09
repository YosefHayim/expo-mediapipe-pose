import libraryPackage from "expo-mediapipe-pose/package.json";
import { Select } from "@/controls/select";
import type { SourceMode } from "@/types";
import type { PlaygroundScreen } from "./use-playground";

type IntegrationSectionProps = Pick<
	PlaygroundScreen,
	"code" | "codeMode" | "copy" | "setCodeMode"
>;

export const IntegrationSection = ({
	code,
	codeMode,
	copy,
	setCodeMode,
}: IntegrationSectionProps) => {
	return (
		<section id="integration" className="integration">
			<div className="integration-copy">
				<p className="eyebrow">FROM EXPERIMENT TO APP</p>
				<h2>
					Keep what works.
					<br />
					Take the code.
				</h2>
				<p>
					Your configuration, translated into the native Expo API. Choose the
					integration you need.
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
					Requires an iOS/Android development build; Expo Go cannot load this
					module. Local models need a phone-local path.
				</p>
				<p className="caption">
					Photo/video snippets expose a consumer callback for your renderer and
					safely release masks. Camera rules and styles appear in the camera
					snippet.
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
		</section>
	);
};
