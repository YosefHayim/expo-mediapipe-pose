import { type CSSProperties, useRef } from "react";
import { useInView } from "@/landing/motion/reveal";
import "./tick-rule.css";

const tickCount = 61;
const ticks = Array.from({ length: tickCount }, (_, index) => index);

/** A measuring-tape divider: a hairline with ticks, every fifth one taller. */
export const TickRule = () => {
	const ref = useRef<HTMLDivElement>(null);
	const isDrawn = useInView(ref, {
		once: true,
		threshold: 0.15,
		rootMargin: "0px 0px -8% 0px",
	});

	return (
		<div
			ref={ref}
			className={`tick-rule${isDrawn ? " is-drawn" : ""}`}
			aria-hidden="true"
		>
			<div className="container">
				<div className="tick-rule-track">
					<span className="tick-rule-line" />
					{ticks.map((tick) => (
						<span
							key={tick}
							className={tick % 5 === 0 ? "tick tick-long" : "tick"}
							style={
								{
									left: `${(tick / (tickCount - 1)) * 100}%`,
									"--tick-index": tick,
								} as CSSProperties
							}
						/>
					))}
				</div>
			</div>
		</div>
	);
};
