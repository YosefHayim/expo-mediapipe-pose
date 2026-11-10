import { type ReactNode, useId } from "react";

interface SelectProps {
	label: string;
	value: string;
	onChange: (choice: string) => void;
	children: ReactNode;
}

export const Select = ({ label, value, onChange, children }: SelectProps) => {
	const id = useId();
	return (
		<label className="field" htmlFor={id}>
			{label}
			<select
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			>
				{children}
			</select>
		</label>
	);
};
