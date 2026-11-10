import type { ChangeEvent } from "react";
import { createReadableLabel } from "./humanize";

type ThresholdKey = "enterThreshold" | "exitThreshold";

interface ThresholdInputProps {
	fieldKey: ThresholdKey;
	value: string;
	onFieldChange: (fieldKey: ThresholdKey, value: string) => void;
}

export const ThresholdInput = ({
	fieldKey,
	value,
	onFieldChange,
}: ThresholdInputProps) => {
	const handleThresholdInputChange = (event: ChangeEvent<HTMLInputElement>) =>
		onFieldChange(fieldKey, event.target.value);

	return (
		<label className="field">
			{createReadableLabel(fieldKey)}
			<input
				type="number"
				step="any"
				min={-10000}
				max={10000}
				value={value}
				onChange={handleThresholdInputChange}
			/>
		</label>
	);
};
