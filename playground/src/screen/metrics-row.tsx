import { Metric } from "./metric";
import type { PlaygroundScreen } from "./use-playground";

type MetricsStripProps = Pick<PlaygroundScreen, "engine" | "frame">;

export const MetricsStrip = ({ engine, frame }: MetricsStripProps) => {
	const hasFrame = frame != null;
	const framePosesCountLabel = hasFrame ? String(frame.poses.length) : "—";
	const frameDurationLabel = hasFrame
		? `${frame.inferenceDurationMs.toFixed(0)} ms`
		: "—";

	return (
		<div className="metrics">
			<Metric label="Poses detected" value={framePosesCountLabel} />
			<Metric label="Inference time" value={frameDurationLabel} />
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
