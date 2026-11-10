import { LANDMARK_NAMES } from "expo-mediapipe-pose/core";
import { createReadableLabel } from "./humanize";
import { Select } from "./select";

export type RuleLandmarkKey = "start" | "vertex" | "end";

interface RuleLandmarkSelectProps {
	fieldKey: RuleLandmarkKey;
	value: string;
	onFieldChange: (fieldKey: RuleLandmarkKey, landmark: string) => void;
}

export const RuleLandmarkSelect = ({
	fieldKey,
	value,
	onFieldChange,
}: RuleLandmarkSelectProps) => {
	const handleLandmarkSelectChange = (landmark: string) =>
		onFieldChange(fieldKey, landmark);

	return (
		<Select
			label={createReadableLabel(fieldKey)}
			value={value}
			onChange={handleLandmarkSelectChange}
		>
			{LANDMARK_NAMES.map((name) => (
				<option key={name}>{name}</option>
			))}
		</Select>
	);
};
