import { useEffect, useState } from "react";
import type { Rule } from "@/config";
import { Color } from "./color";
import { Range } from "./range";
import {
	type RuleLandmarkKey,
	RuleLandmarkSelect,
} from "./rule-landmark-select";
import { Select } from "./select";
import { ThresholdInput } from "./threshold-input";

interface RuleEditorProps {
	rule: Rule;
	index: number;
	onChange: (index: number, rule: Rule) => void;
	onRemove: (index: number) => void;
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
	const update = (patch: Partial<Rule>) =>
		onChange(index, { ...rule, ...patch });
	const handleRuleRemoveClick = () => onRemove(index);

	const handleRuleLandmarkChange = (key: RuleLandmarkKey, landmark: string) =>
		update({ [key]: landmark });

	const updateThreshold = (
		key: "enterThreshold" | "exitThreshold",
		choice: string,
	) => {
		const next = { ...draft, [key]: choice };
		setDraft(next);
		const enterThreshold = Number(next.enterThreshold);
		const exitThreshold = Number(next.exitThreshold);
		const hasBoth =
			next.enterThreshold.trim() !== "" && next.exitThreshold.trim() !== "";

		const bounded = [enterThreshold, exitThreshold].every(
			(number) => Number.isFinite(number) && Math.abs(number) <= 10000,
		);

		const isRangeIncomplete = !hasBoth || !bounded;
		if (isRangeIncomplete) {
			setThresholdError(
				"Enter thresholds between −10,000 and 10,000. The last valid values remain active.",
			);
			return;
		}

		const isRuleDirectionAbove = rule.direction === "above";
		const ordered = isRuleDirectionAbove
			? enterThreshold > exitThreshold
			: enterThreshold < exitThreshold;

		const isUnordered = !ordered;
		if (isUnordered) {
			setThresholdError(
				"Entry and exit must leave a non-empty hysteresis band. The last valid values remain active.",
			);
			return;
		}

		setThresholdError("");
		onChange(index, { ...rule, enterThreshold, exitThreshold });
	};

	const isRuleKindNotHeight = rule.kind !== "height";

	const handleRuleKindChange = (kind: Rule["kind"]) => {
		const isKindHeight = kind === "height";
		return update({
			kind,
			space: isKindHeight ? "image" : rule.space,
		});
	};

	const handleRuleSpaceChange = (space: Rule["space"]) => update({ space });

	const handleRuleDirectionChange = (direction: Rule["direction"]) =>
		update({
			direction,
			enterThreshold: rule.exitThreshold,
			exitThreshold: rule.enterThreshold,
		});

	const handleRuleMinVisibilityChange = (minVisibility: number) =>
		update({ minVisibility });

	const handleRuleHoldMsChange = (holdMs: number) => update({ holdMs });

	const handleRuleStaleAfterMsChange = (staleAfterMs: number) =>
		update({ staleAfterMs });

	const handleRulePassColorChange = (passColor: string) =>
		update({ passColor });

	const handleRuleFailColorChange = (failColor: string) =>
		update({ failColor });

	const handleRuleUnknownColorChange = (unknownColor: string) =>
		update({ unknownColor });

	const hasThresholdError = thresholdError !== "";

	return (
		<fieldset className="rule-editor">
			<legend>Rule {index + 1}</legend>
			<Select
				label={`Rule ${index + 1} measurement`}
				value={rule.kind}
				onChange={handleRuleKindChange}
			>
				<option value="angle">Joint angle</option>
				<option value="distance">Distance</option>
				<option value="height">Vertical difference (image pixels)</option>
			</Select>
			{isRuleKindNotHeight && (
				<Select
					label="Coordinate space"
					value={rule.space}
					onChange={handleRuleSpaceChange}
				>
					<option value="image">Image · pixels / degrees</option>
					<option value="world">World · estimated meters / degrees</option>
				</Select>
			)}
			{(["start", "vertex", "end"] as const).map((key) => (
				<RuleLandmarkSelect
					key={key}
					fieldKey={key}
					value={rule[key]}
					onFieldChange={handleRuleLandmarkChange}
				/>
			))}
			<small>Vertex also selects the joint colored by this rule.</small>
			<Select
				label="Pass direction"
				value={rule.direction}
				onChange={handleRuleDirectionChange}
			>
				<option value="below">Below</option>
				<option value="above">Above</option>
			</Select>
			<div className="two-fields">
				{(["enterThreshold", "exitThreshold"] as const).map((key) => (
					<ThresholdInput
						key={key}
						fieldKey={key}
						value={draft[key]}
						onFieldChange={updateThreshold}
					/>
				))}
			</div>
			{hasThresholdError && <small role="alert">{thresholdError}</small>}
			<Range
				label="Rule confidence"
				value={rule.minVisibility}
				min={0}
				max={1}
				step={0.05}
				onChange={handleRuleMinVisibilityChange}
			/>
			<Range
				label="Hold duration (ms)"
				value={rule.holdMs}
				min={0}
				max={2000}
				step={50}
				onChange={handleRuleHoldMsChange}
			/>
			<Range
				label="Stale after (ms)"
				value={rule.staleAfterMs}
				min={100}
				max={5000}
				step={100}
				onChange={handleRuleStaleAfterMsChange}
			/>
			<Color
				label="Pass color"
				value={rule.passColor}
				onChange={handleRulePassColorChange}
			/>
			<Color
				label="Fail color"
				value={rule.failColor}
				onChange={handleRuleFailColorChange}
			/>
			<Color
				label="Unknown color"
				value={rule.unknownColor}
				onChange={handleRuleUnknownColorChange}
			/>
			<button type="button" onClick={handleRuleRemoveClick}>
				Remove rule
			</button>
		</fieldset>
	);
};
