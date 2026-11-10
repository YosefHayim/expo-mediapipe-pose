import { type ChangeEvent, useId } from "react";

interface RangeProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (amount: number) => void;
	hint?: string;
}

export const Range = ({
	label,
	value,
	min,
	max,
	step = 1,
	onChange,
	hint,
}: RangeProps) => {
	const id = useId();
	const handleRangeInputChange = (event: ChangeEvent<HTMLInputElement>) =>
		onChange(Number(event.target.value));

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
				onChange={handleRangeInputChange}
			/>
			{hint && <small>{hint}</small>}
		</div>
	);
};
