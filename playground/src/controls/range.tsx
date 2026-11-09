import { useId } from "react";

interface RangeProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
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
};
