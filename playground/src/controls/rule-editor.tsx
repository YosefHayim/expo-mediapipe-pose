import { LANDMARK_NAMES } from "expo-mediapipe-pose/core";
import { useEffect, useState } from "react";
import type { Rule } from "@/config";
import { Color } from "./color";
import { humanize } from "./humanize";
import { Range } from "./range";
import { Select } from "./select";

interface RuleEditorProps {
	rule: Rule;
	index: number;
	onChange: (rule: Rule) => void;
	onRemove: () => void;
}

export const RuleEditor = ({
	rule,
	index,
	onChange,
	onRemove,
}: RuleEditorProps) => {
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
};
