import {
	BODY_PARTS,
	type ConnectionName,
	LANDMARK_NAMES,
	type LandmarkName,
	POSE_CONNECTIONS,
} from "expo-mediapipe-pose/core";
import { type ChangeEvent, useState } from "react";
import { defaultRule, type Rule, type Settings } from "@/config";
import { type BodyPart, BodyPartChip } from "./body-part-chip";
import { Color } from "./color";
import { createReadableLabel } from "./humanize";
import { KeyedRange } from "./keyed-range";
import { Range } from "./range";
import { RuleEditor } from "./rule-editor";
import { Select } from "./select";
import { Toggle } from "./toggle";

type DetectionThresholdKey =
	| "minPoseDetectionConfidence"
	| "minPosePresenceConfidence"
	| "minTrackingConfidence";

type TimingKey = "previewFps" | "frameLimit" | "callbackFps";

interface ControlsProps {
	config: Settings;
	setConfig: (settings: Settings) => void;
	onModel: (file: File) => void;
}

export const Controls = ({
	config: c,
	setConfig: setSettings,
	onModel,
}: ControlsProps) => {
	const [joint, setJoint] = useState<LandmarkName>("leftWrist");
	const [edge, setEdge] = useState<ConnectionName>("leftElbow:leftWrist");
	const updateDetection = (patch: Partial<Settings["detection"]>) =>
		setSettings({ ...c, detection: { ...c.detection, ...patch } });
	const updateSkeleton = (patch: Partial<Settings["skeleton"]>) =>
		setSettings({ ...c, skeleton: { ...c.skeleton, ...patch } });
	const jointStyle = c.skeleton.joints[joint] ?? {
		color: c.skeleton.color,
		radius: c.skeleton.jointRadius,
	};
	const edgeStyle = c.skeleton.connections[edge] ?? {
		color: c.skeleton.color,
		width: c.skeleton.lineWidth,
	};
	const handleSkeletonEnabledChange = (enabled: boolean) =>
		updateSkeleton({ enabled });

	const handleSkeletonColorChange = (color: string) =>
		updateSkeleton({ color });

	const handleSkeletonJointRadiusChange = (jointRadius: number) =>
		updateSkeleton({ jointRadius });

	const handleSkeletonLineWidthChange = (lineWidth: number) =>
		updateSkeleton({ lineWidth });

	const handleSkeletonMinVisibilityChange = (minVisibility: number) =>
		updateSkeleton({ minVisibility });

	const handleJointLandmarkChange = (landmark: string) =>
		setJoint(landmark as LandmarkName);

	const handleJointLandmarkVisibleChange = (choice: boolean) =>
		updateSkeleton({
			landmarks: choice
				? [...c.skeleton.landmarks, joint]
				: c.skeleton.landmarks.filter((name) => name !== joint),
		});

	const handleJointColorChange = (color: string) =>
		updateSkeleton({
			joints: {
				...c.skeleton.joints,
				[joint]: { ...jointStyle, color },
			},
		});

	const handleJointRadiusChange = (radius: number) =>
		updateSkeleton({
			joints: {
				...c.skeleton.joints,
				[joint]: { ...jointStyle, radius },
			},
		});

	const handleJointResetClick = () => {
		const joints = { ...c.skeleton.joints };
		delete joints[joint];
		updateSkeleton({ joints });
	};

	const handleEdgeConnectionChange = (connection: string) =>
		setEdge(connection as ConnectionName);

	const handleEdgeColorChange = (color: string) =>
		updateSkeleton({
			connections: {
				...c.skeleton.connections,
				[edge]: { ...edgeStyle, color },
			},
		});

	const handleEdgeWidthChange = (width: number) =>
		updateSkeleton({
			connections: {
				...c.skeleton.connections,
				[edge]: { ...edgeStyle, width },
			},
		});

	const handleEdgeResetClick = () => {
		const connections = { ...c.skeleton.connections };
		delete connections[edge];
		updateSkeleton({ connections });
	};

	const handleBodyPartToggle = (part: BodyPart) => {
		const isPartSelected = c.skeleton.bodyParts.includes(part);
		const bodyParts = isPartSelected
			? c.skeleton.bodyParts.filter((p) => p !== part)
			: [...c.skeleton.bodyParts, part];
		updateSkeleton({ bodyParts });
	};

	const handleDetectionThresholdChange = (
		key: DetectionThresholdKey,
		amount: number,
	) => updateDetection({ [key]: amount });

	const handleTimingChange = (key: TimingKey, amount: number) =>
		setSettings({ ...c, timing: { ...c.timing, [key]: amount } });

	const handleRuleChange = (index: number, next: Rule) =>
		setSettings({
			...c,
			rules: c.rules.map((r, i) => {
				const isSameIndex = i === index;
				return isSameIndex ? next : r;
			}),
		});

	const handleRuleRemove = (index: number) =>
		setSettings({
			...c,
			rules: c.rules.filter((_, i) => i !== index),
		});

	const handleMaxPosesChange = (maxPoses: number) =>
		updateDetection({ maxPoses });

	const handlePoseIndexChange = (poseIndex: number) =>
		updateSkeleton({ poseIndex });

	const handleModelVariantChange = (choice: string) =>
		updateDetection({
			modelVariant: choice as Settings["detection"]["modelVariant"],
		});

	const handleModelFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file) onModel(file);
	};

	const handleSegmentationEnabledChange = (segmentationEnabled: boolean) =>
		updateDetection({ segmentationEnabled });

	const handleMaskMaxDimensionChange = (maskMaxDimension: number) =>
		updateDetection({ maskMaxDimension });

	const handleMaskColorChange = (color: string) =>
		setSettings({ ...c, mask: { ...c.mask, color } });

	const handleMaskOpacityChange = (opacity: number) =>
		setSettings({ ...c, mask: { ...c.mask, opacity } });

	const handleRuleAddClick = () =>
		setSettings({
			...c,
			rules: [...c.rules, { ...defaultRule, id: crypto.randomUUID() }],
		});

	const handleCameraFacingChange = (choice: string) =>
		setSettings({
			...c,
			native: {
				...c.native,
				cameraFacing: choice as "front" | "back",
			},
		});

	const handleCameraLensChange = (choice: string) =>
		setSettings({
			...c,
			native: {
				...c.native,
				cameraLens: choice as Settings["native"]["cameraLens"],
			},
		});

	const handleCameraZoomFactorChange = (cameraZoomFactor: number) =>
		setSettings({ ...c, native: { ...c.native, cameraZoomFactor } });

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
						onChange={handleSkeletonEnabledChange}
					/>
					<Color
						label="Skeleton color"
						value={c.skeleton.color}
						onChange={handleSkeletonColorChange}
					/>
					<div className="two-fields">
						<Range
							label="Joint radius"
							value={c.skeleton.jointRadius}
							min={0}
							max={20}
							onChange={handleSkeletonJointRadiusChange}
						/>
						<Range
							label="Line width"
							value={c.skeleton.lineWidth}
							min={0}
							max={15}
							onChange={handleSkeletonLineWidthChange}
						/>
					</div>
					<Range
						label="Visible joint confidence"
						value={c.skeleton.minVisibility}
						min={0}
						max={1}
						step={0.05}
						onChange={handleSkeletonMinVisibilityChange}
					/>
					<fieldset>
						<legend>Body regions</legend>
						<div className="chips">
							{Object.keys(BODY_PARTS).map((name) => {
								const part = name as BodyPart;
								const isSelected = c.skeleton.bodyParts.includes(part);
								return (
									<BodyPartChip
										key={part}
										part={part}
										isSelected={isSelected}
										onToggle={handleBodyPartToggle}
									/>
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
								onChange={handleJointLandmarkChange}
							>
								{LANDMARK_NAMES.map((name) => (
									<option key={name}>{name}</option>
								))}
							</Select>
							<Toggle
								label="Include this landmark"
								value={c.skeleton.landmarks.includes(joint)}
								onChange={handleJointLandmarkVisibleChange}
							/>
							<Color
								label="Joint override color"
								value={jointStyle.color}
								onChange={handleJointColorChange}
							/>
							<Range
								label="Joint override radius"
								value={jointStyle.radius}
								min={0}
								max={20}
								onChange={handleJointRadiusChange}
							/>
							<button type="button" onClick={handleJointResetClick}>
								Clear joint override
							</button>
							<Select
								label="Connection to customize"
								value={edge}
								onChange={handleEdgeConnectionChange}
							>
								{POSE_CONNECTIONS.map(([a, b]) => (
									<option key={`${a}:${b}`}>{`${a}:${b}`}</option>
								))}
							</Select>
							<Color
								label="Connection override color"
								value={edgeStyle.color}
								onChange={handleEdgeColorChange}
							/>
							<Range
								label="Connection override width"
								value={edgeStyle.width}
								min={0}
								max={15}
								onChange={handleEdgeWidthChange}
							/>
							<button type="button" onClick={handleEdgeResetClick}>
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
						onChange={handleMaxPosesChange}
					/>
					<Range
						label="Selected pose index"
						value={c.skeleton.poseIndex}
						min={0}
						max={5}
						onChange={handlePoseIndexChange}
						hint="A result index, not a persistent person identity. Missing selections remain empty."
					/>
					{(
						[
							"minPoseDetectionConfidence",
							"minPosePresenceConfidence",
							"minTrackingConfidence",
						] as const
					).map((key) => (
						<KeyedRange
							key={key}
							fieldKey={key}
							label={createReadableLabel(key)}
							value={c.detection[key]}
							min={0}
							max={1}
							step={0.05}
							onFieldChange={handleDetectionThresholdChange}
						/>
					))}
					<Select
						label="Pose model"
						value={c.detection.modelVariant}
						onChange={handleModelVariantChange}
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
							onChange={handleModelFileChange}
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
							<KeyedRange
								key={key}
								fieldKey={key}
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
								onFieldChange={handleTimingChange}
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
						onChange={handleSegmentationEnabledChange}
					/>
					<Range
						label="Mask maximum dimension"
						value={c.detection.maskMaxDimension}
						min={64}
						max={512}
						step={16}
						onChange={handleMaskMaxDimensionChange}
					/>
					<Color
						label="Mask tint"
						value={c.mask.color}
						onChange={handleMaskColorChange}
					/>
					<Range
						label="Mask opacity"
						value={c.mask.opacity}
						min={0}
						max={1}
						step={0.05}
						onChange={handleMaskOpacityChange}
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
							onChange={handleRuleChange}
							onRemove={handleRuleRemove}
						/>
					))}
					<button
						type="button"
						disabled={c.rules.length >= 6}
						onClick={handleRuleAddClick}
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
						onChange={handleCameraFacingChange}
					>
						<option value="front">Front</option>
						<option value="back">Back</option>
					</Select>
					<Select
						label="Native lens"
						value={c.native.cameraLens}
						onChange={handleCameraLensChange}
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
						onChange={handleCameraZoomFactorChange}
					/>
					<small>
						Requested zoom is clamped by the device. Android rejects ultra wide.
						Use getCameraCapabilities before selecting native modes.
					</small>
				</div>
			</details>
		</div>
	);
};
