import type { CSSProperties } from "react";

const TICK_COUNT = 41;
const ticks = Array.from({ length: TICK_COUNT }, (_, index) => index);

/** The measuring-tape rule between the title and the lead; it draws in from the left. */
export const HeroTickRule = () => (
	<span className="hero-rule" aria-hidden="true">
		<span className="hero-rule-line" />
		{ticks.map((tick) => (
			<span
				key={tick}
				className={tick % 5 === 0 ? "hero-tick hero-tick-long" : "hero-tick"}
				style={
					{
						left: `${(tick / (TICK_COUNT - 1)) * 100}%`,
						"--tick-index": tick,
					} as CSSProperties
				}
			/>
		))}
	</span>
);
