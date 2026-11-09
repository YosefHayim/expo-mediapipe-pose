import { type ReactNode, useId } from "react";

interface SelectProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	children: ReactNode;
}

export const Select = ({ label, value, onChange, children }: SelectProps) => {
	const id = useId();
	return (
		<label className="field" htmlFor={id}>
			{label}
			<select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
				{children}
			</select>
		</label>
	);
};
