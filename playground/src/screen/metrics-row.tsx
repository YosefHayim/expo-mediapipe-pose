import { Metric } from "./metric";
import type { PlaygroundScreen } from "./use-playground";

type MetricsRowProps = Pick<PlaygroundScreen, "engine" | "frame">;

export const MetricsRow = ({ engine, frame }: MetricsRowProps) => {
	return (
		<div className="metrics">
			<Metric
				label="Poses detected"
				value={frame ? String(frame.poses.length) : "—"}
			/>
			<Metric
				label="Inference time"
				value={frame ? `${frame.inferenceDurationMs.toFixed(0)} ms` : "—"}
			/>
			<Metric
				label="Inference / result FPS"
				value={
					engine.cadence.inference
						? `${engine.cadence.inference.toFixed(1)} / ${engine.cadence.results.toFixed(1)}`
						: "—"
				}
			/>
		</div>
	);
};
