import type { MediaMode } from "@/playground/types";

export type OpenPlaygroundOptions = {
	/** One of "full", "arms", "multiple" or "mask". */
	preset?: string;
	mode?: MediaMode;
};

export const openPlaygroundEventName = "open-playground";

/** Scrolls to the playground and asks it to load, then apply the options. */
export const openPlayground = (options?: OpenPlaygroundOptions) => {
	const isMotionReduced = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	document
		.getElementById("playground")
		?.scrollIntoView({ behavior: isMotionReduced ? "instant" : "smooth" });
	window.dispatchEvent(
		new CustomEvent<OpenPlaygroundOptions>(openPlaygroundEventName, {
			detail: options ?? {},
		}),
	);
};
