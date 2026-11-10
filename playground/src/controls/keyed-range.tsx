import { Range } from "./range";

interface KeyedRangeProps<Key extends string> {
	fieldKey: Key;
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onFieldChange: (fieldKey: Key, amount: number) => void;
}

export const KeyedRange = <Key extends string>({
	fieldKey,
	label,
	value,
	min,
	max,
	step,
	onFieldChange,
}: KeyedRangeProps<Key>) => {
	const handleFieldRangeChange = (amount: number) =>
		onFieldChange(fieldKey, amount);

	return (
		<Range
			label={label}
			value={value}
			min={min}
			max={max}
			step={step}
			onChange={handleFieldRangeChange}
		/>
	);
};
