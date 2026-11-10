import { type ChangeEvent, type ReactNode, useId } from "react";

interface SelectProps {
	label: string;
	value: string;
	onChange: (choice: string) => void;
	children: ReactNode;
}

export const Select = ({ label, value, onChange, children }: SelectProps) => {
	const id = useId();
	const handleSelectInputChange = (event: ChangeEvent<HTMLSelectElement>) =>
		onChange(event.target.value);

	return (
		<label className="field" htmlFor={id}>
			{label}
			<select id={id} value={value} onChange={handleSelectInputChange}>
				{children}
			</select>
		</label>
	);
};
