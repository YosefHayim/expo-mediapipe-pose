import {
	BODY_PARTS,
	type ConnectionName,
	LANDMARK_NAMES,
	type LandmarkName,
	POSE_CONNECTIONS,
} from "expo-mediapipe-pose/core";
import { type ReactNode, useEffect, useId, useState } from "react";
import { type Config, defaultRule, type Rule } from "./config";

export function Range({
	label,
	value,
	min,
	max,
	step = 1,
	onChange,
	hint,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	hint?: string;
}) {
	const id = useId();
	return (
		<div className="field">
			<label htmlFor={id}>
				{label}
				<output>{Number(value.toFixed(3))}</output>
			</label>
			<input
				id={id}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number(e.target.value))}
			/>
			{hint && <small>{hint}</small>}
		</div>
	);
}
export function Select({
	label,
	value,
	onChange,
	children,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	children: ReactNode;
}) {
	const id = useId();
	return (
		<label className="field" htmlFor={id}>
			{label}
			<select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
				{children}
			</select>
		</label>
	);
}
function Color({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	return (
		<label className="color-field">
			<span>{label}</span>
			<input
				aria-label={label}
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<code>{value}</code>
		</label>
	);
}
function Toggle({
	label,
	value,
	onChange,
}: {
	label: string;
	value: boolean;
	onChange: (value: boolean) => void;
}) {
	return (
		<label className="toggle">
			<input
				type="checkbox"
				checked={value}
				onChange={(e) => onChange(e.target.checked)}
			/>
			{label}
		</label>
	);
}
const humanize = (value: string) =>
	value.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
export function Controls({
	config: c,
	setConfig,
	onModel,
}: {
	config: Config;
	setConfig: (config: Config) => void;
	onModel: (file: File) => void;
}) {
	const [joint, setJoint] = useState<LandmarkName>("leftWrist");
	const [edge, setEdge] = useState<ConnectionName>("leftElbow:leftWrist");
	const d = (patch: Partial<Config["detection"]>) =>
		setConfig({ ...c, detection: { ...c.detection, ...patch } });
	const s = (patch: Partial<Config["skeleton"]>) =>
		setConfig({ ...c, skeleton: { ...c.skeleton, ...patch } });
	const jointStyle = c.skeleton.joints[joint] ?? {
		color: c.skeleton.color,
		radius: c.skeleton.jointRadius,
	};
	const edgeStyle = c.skeleton.connections[edge] ?? {
		color: c.skeleton.color,
		width: c.skeleton.lineWidth,
	};
	return (
		<div className="control-groups">
			<details open>
				<summary>
					Skeleton <span>Appearance</span>
				</summary>
				<div className="group-body">
					<Toggle
						label="Show skeleton"
						value={c.skeleton.enabled}
						onChange={(enabled) => s({ enabled })}
					/>
					<Color
						label="Skeleton color"
						value={c.skeleton.color}
						onChange={(color) => s({ color })}
					/>
					<div className="two-fields">
						<Range
							label="Joint radius"
							value={c.skeleton.jointRadius}
							min={0}
							max={20}
							onChange={(jointRadius) => s({ jointRadius })}
						/>
						<Range
							label="Line width"
							value={c.skeleton.lineWidth}
							min={0}
							max={15}
							onChange={(lineWidth) => s({ lineWidth })}
						/>
					</div>
					<Range
						label="Visible joint confidence"
						value={c.skeleton.minVisibility}
						min={0}
						max={1}
						step={0.05}
						onChange={(minVisibility) => s({ minVisibility })}
					/>
					<fieldset>
						<legend>Body regions</legend>
						<div className="chips">
							{Object.keys(BODY_PARTS).map((name) => {
								const part = name as keyof typeof BODY_PARTS;
								const selected = c.skeleton.bodyParts.includes(part);
								return (
									<button
										type="button"
										key={part}
										aria-pressed={selected}
										onClick={() =>
											s({
												bodyParts: selected
													? c.skeleton.bodyParts.filter((p) => p !== part)
													: [...c.skeleton.bodyParts, part],
											})
										}
									>
										{humanize(part)}
									</button>
								);
							})}
						</div>
					</fieldset>
					<details>
						<summary>Individual joints & connections</summary>
						<div className="group-body">
							<Select
								label="Joint to customize"
								value={joint}
								onChange={(value) => setJoint(value as LandmarkName)}
							>
								{LANDMARK_NAMES.map((name) => (
									<option key={name}>{name}</option>
								))}
							</Select>
							<Toggle
								label="Include this landmark"
								value={c.skeleton.landmarks.includes(joint)}
								onChange={(value) =>
									s({
										landmarks: value
											? [...c.skeleton.landmarks, joint]
											: c.skeleton.landmarks.filter((name) => name !== joint),
									})
								}
							/>
							<Color
								label="Joint override color"
								value={jointStyle.color}
								onChange={(color) =>
									s({
										joints: {
											...c.skeleton.joints,
											[joint]: { ...jointStyle, color },
										},
									})
								}
							/>
							<Range
								label="Joint override radius"
								value={jointStyle.radius}
								min={0}
								max={20}
								onChange={(radius) =>
									s({
										joints: {
											...c.skeleton.joints,
											[joint]: { ...jointStyle, radius },
										},
									})
								}
							/>
							<button
								type="button"
								onClick={() => {
									const joints = { ...c.skeleton.joints };
									delete joints[joint];
									s({ joints });
								}}
							>
								Clear joint override
							</button>
							<Select
								label="Connection to customize"
								value={edge}
								onChange={(value) => setEdge(value as ConnectionName)}
							>
								{POSE_CONNECTIONS.map(([a, b]) => (
									<option key={`${a}:${b}`}>{`${a}:${b}`}</option>
								))}
							</Select>
							<Color
								label="Connection override color"
								value={edgeStyle.color}
								onChange={(color) =>
									s({
										connections: {
											...c.skeleton.connections,
											[edge]: { ...edgeStyle, color },
										},
									})
								}
							/>
							<Range
								label="Connection override width"
								value={edgeStyle.width}
								min={0}
								max={15}
								onChange={(width) =>
									s({
										connections: {
											...c.skeleton.connections,
											[edge]: { ...edgeStyle, width },
										},
									})
								}
							/>
							<button
								type="button"
								onClick={() => {
									const connections = { ...c.skeleton.connections };
									delete connections[edge];
									s({ connections });
								}}
							>
								Clear connection override
							</button>
						</div>
					</details>
				</div>
			</details>
			<details>
				<summary>
					Detection <span>Model & confidence</span>
				</summary>
				<div className="group-body">
					<Range
						label="Maximum poses"
						value={c.detection.maxPoses}
						min={1}
						max={6}
						onChange={(maxPoses) => d({ maxPoses })}
					/>
					<Range
						label="Selected pose index"
						value={c.skeleton.poseIndex}
						min={0}
						max={5}
						onChange={(poseIndex) => s({ poseIndex })}
						hint="A result index, not a persistent person identity. Missing selections remain empty."
					/>
					{(
						[
							"minPoseDetectionConfidence",
							"minPosePresenceConfidence",
							"minTrackingConfidence",
						] as const
					).map((key) => (
						<Range
							key={key}
							label={humanize(key)}
							value={c.detection[key]}
							min={0}
							max={1}
							step={0.05}
							onChange={(value) => d({ [key]: value })}
						/>
					))}
					<Select
						label="Pose model"
						value={c.detection.modelVariant}
						onChange={(value) =>
							d({ modelVariant: value as Config["detection"]["modelVariant"] })
						}
					>
						<option value="full">Full · bundled</option>
						<option value="lite">Lite · local .task required</option>
						<option value="heavy">Heavy · local .task required</option>
					</Select>
					<label className="file-label">
						Load a local .task model
						<input
							type="file"
							accept=".task"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) onModel(file);
							}}
						/>
					</label>
					<small>
						Browser CPU inference. File labels do not verify model contents.
						Selecting a different variant clears the local model.
					</small>
				</div>
			</details>
			<details>
				<summary>
					Timing <span>Capture & delivery</span>
				</summary>
				<div className="group-body">
					{(["previewFps", "frameLimit", "callbackFps"] as const).map(
						(key, i) => (
							<Range
								key={key}
								label={
									[
										"Capture target FPS",
										"Inference limit FPS",
										"Result delivery FPS",
									][i] ?? key
								}
								value={c.timing[key]}
								min={1}
								max={60}
								onChange={(value) =>
									setConfig({ ...c, timing: { ...c.timing, [key]: value } })
								}
							/>
						),
					)}
					<small>
						Targets are not guaranteed. Delivery limits do not reduce inference
						work. Uploads are resized to at most 1280 px for browser inference.
					</small>
				</div>
			</details>
			<details>
				<summary>
					Segmentation <span>Person masks</span>
				</summary>
				<div className="group-body">
					<Toggle
						label="Enable segmentation"
						value={c.detection.segmentationEnabled}
						onChange={(segmentationEnabled) => d({ segmentationEnabled })}
					/>
					<Range
						label="Mask maximum dimension"
						value={c.detection.maskMaxDimension}
						min={64}
						max={512}
						step={16}
						onChange={(maskMaxDimension) => d({ maskMaxDimension })}
					/>
					<Color
						label="Mask tint"
						value={c.mask.color}
						onChange={(color) =>
							setConfig({ ...c, mask: { ...c.mask, color } })
						}
					/>
					<Range
						label="Mask opacity"
						value={c.mask.opacity}
						min={0}
						max={1}
						step={0.05}
						onChange={(opacity) =>
							setConfig({ ...c, mask: { ...c.mask, opacity } })
						}
					/>
					<small>
						Shows the selected pose's mask. Browser masks do not test native
						file leases or backpressure.
					</small>
				</div>
			</details>
			<details>
				<summary>
					Feedback rules <span>{c.rules.length} active</span>
				</summary>
				<div className="group-body">
					<p className="muted">
						Build your own conditions. Unknown means missing, uncertain, or
						stale input. These examples do not assess exercise correctness.
					</p>
					{c.rules.map((rule, index) => (
						<RuleEditor
							key={rule.id}
							rule={rule}
							index={index}
							onChange={(next) =>
								setConfig({
									...c,
									rules: c.rules.map((r, i) => (i === index ? next : r)),
								})
							}
							onRemove={() =>
								setConfig({
									...c,
									rules: c.rules.filter((_, i) => i !== index),
								})
							}
						/>
					))}
					<button
						type="button"
						disabled={c.rules.length >= 6}
						onClick={() =>
							setConfig({
								...c,
								rules: [
									...c.rules,
									{ ...defaultRule, id: crypto.randomUUID() },
								],
							})
						}
					>
						+ Add a rule
					</button>
				</div>
			</details>
			<details>
				<summary>
					Expo device settings <span>Native only</span>
				</summary>
				<div className="group-body">
					<p className="muted">
						Included in exported camera code. Verify these on a physical
						iOS/Android device.
					</p>
					<Select
						label="Native camera facing"
						value={c.native.cameraFacing}
						onChange={(value) =>
							setConfig({
								...c,
								native: {
									...c.native,
									cameraFacing: value as "front" | "back",
								},
							})
						}
					>
						<option value="front">Front</option>
						<option value="back">Back</option>
					</Select>
					<Select
						label="Native lens"
						value={c.native.cameraLens}
						onChange={(value) =>
							setConfig({
								...c,
								native: {
									...c.native,
									cameraLens: value as Config["native"]["cameraLens"],
								},
							})
						}
					>
						<option value="auto">Auto</option>
						<option value="wide">Wide</option>
						<option value="ultraWide">
							Ultra wide · supported iOS devices
						</option>
					</Select>
					<Range
						label="Native zoom factor"
						value={c.native.cameraZoomFactor}
						min={1}
						max={10}
						step={0.1}
						onChange={(cameraZoomFactor) =>
							setConfig({ ...c, native: { ...c.native, cameraZoomFactor } })
						}
					/>
					<small>
						Requested zoom is clamped by the device. Android rejects ultra wide.
						Use getCameraCapabilities before selecting native modes.
					</small>
				</div>
			</details>
		</div>
	);
}
function RuleEditor({
	rule,
	index,
	onChange,
	onRemove,
}: {
	rule: Rule;
	index: number;
	onChange: (rule: Rule) => void;
	onRemove: () => void;
}) {
	const [thresholdError, setThresholdError] = useState("");
	const [draft, setDraft] = useState({
		enterThreshold: String(rule.enterThreshold),
		exitThreshold: String(rule.exitThreshold),
	});
	useEffect(() => {
		setDraft({
			enterThreshold: String(rule.enterThreshold),
			exitThreshold: String(rule.exitThreshold),
		});
		setThresholdError("");
	}, [rule.enterThreshold, rule.exitThreshold]);
	const update = (patch: Partial<Rule>) => onChange({ ...rule, ...patch });
	const threshold = (
		key: "enterThreshold" | "exitThreshold",
		value: string,
	) => {
		const next = { ...draft, [key]: value };
		setDraft(next);
		const enterThreshold = Number(next.enterThreshold);
		const exitThreshold = Number(next.exitThreshold);
		const hasBoth =
			next.enterThreshold.trim() !== "" && next.exitThreshold.trim() !== "";
		const bounded = [enterThreshold, exitThreshold].every(
			(number) => Number.isFinite(number) && Math.abs(number) <= 10000,
		);
		if (!hasBoth || !bounded) {
			setThresholdError(
				"Enter thresholds between −10,000 and 10,000. The last valid values remain active.",
			);
			return;
		}
		const ordered =
			rule.direction === "above"
				? enterThreshold > exitThreshold
				: enterThreshold < exitThreshold;
		if (!ordered) {
			setThresholdError(
				"Entry and exit must leave a non-empty hysteresis band. The last valid values remain active.",
			);
			return;
		}
		setThresholdError("");
		onChange({ ...rule, enterThreshold, exitThreshold });
	};

	return (
		<fieldset className="rule-editor">
			<legend>Rule {index + 1}</legend>
			<Select
				label={`Rule ${index + 1} measurement`}
				value={rule.kind}
				onChange={(kind) =>
					update({
						kind: kind as Rule["kind"],
						space: kind === "height" ? "image" : rule.space,
					})
				}
			>
				<option value="angle">Joint angle</option>
				<option value="distance">Distance</option>
				<option value="height">Vertical difference (image pixels)</option>
			</Select>
			{rule.kind !== "height" && (
				<Select
					label="Coordinate space"
					value={rule.space}
					onChange={(space) => update({ space: space as Rule["space"] })}
				>
					<option value="image">Image · pixels / degrees</option>
					<option value="world">World · estimated meters / degrees</option>
				</Select>
			)}
			{(["start", "vertex", "end"] as const).map((key) => (
				<Select
					key={key}
					label={humanize(key)}
					value={rule[key]}
					onChange={(name) => update({ [key]: name })}
				>
					{LANDMARK_NAMES.map((name) => (
						<option key={name}>{name}</option>
					))}
				</Select>
			))}
			<small>Vertex also selects the joint colored by this rule.</small>
			<Select
				label="Pass direction"
				value={rule.direction}
				onChange={(value) =>
					update({
						direction: value as Rule["direction"],
						enterThreshold: rule.exitThreshold,
						exitThreshold: rule.enterThreshold,
					})
				}
			>
				<option value="below">Below</option>
				<option value="above">Above</option>
			</Select>
			<div className="two-fields">
				{(["enterThreshold", "exitThreshold"] as const).map((key) => (
					<label className="field" key={key}>
						{humanize(key)}
						<input
							type="number"
							step="any"
							min={-10000}
							max={10000}
							value={draft[key]}
							onChange={(e) => threshold(key, e.target.value)}
						/>
					</label>
				))}
			</div>
			{thresholdError && <small role="alert">{thresholdError}</small>}
			<Range
				label="Rule confidence"
				value={rule.minVisibility}
				min={0}
				max={1}
				step={0.05}
				onChange={(minVisibility) => update({ minVisibility })}
			/>
			<Range
				label="Hold duration (ms)"
				value={rule.holdMs}
				min={0}
				max={2000}
				step={50}
				onChange={(holdMs) => update({ holdMs })}
			/>
			<Range
				label="Stale after (ms)"
				value={rule.staleAfterMs}
				min={100}
				max={5000}
				step={100}
				onChange={(staleAfterMs) => update({ staleAfterMs })}
			/>
			<Color
				label="Pass color"
				value={rule.passColor}
				onChange={(passColor) => update({ passColor })}
			/>
			<Color
				label="Fail color"
				value={rule.failColor}
				onChange={(failColor) => update({ failColor })}
			/>
			<Color
				label="Unknown color"
				value={rule.unknownColor}
				onChange={(unknownColor) => update({ unknownColor })}
			/>
			<button type="button" onClick={onRemove}>
				Remove rule
			</button>
		</fieldset>
	);
}
