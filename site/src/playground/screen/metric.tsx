interface MetricProps {
	label: string;
	value: string;
}

export const Metric = ({ label, value }: MetricProps) => {
	return (
		<div>
			<span>{label}</span>
			<strong>{value}</strong>
		</div>
	);
};
