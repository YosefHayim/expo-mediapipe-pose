import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";

type AnimatedDetailsProps = {
	summary: ReactNode;
	children: ReactNode;
	className?: string;
	summaryClassName?: string;
	defaultOpen?: boolean;
};

const durationMs = 320;
const slideOffset = "-8px";
const fallbackEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

const readEasing = () =>
	getComputedStyle(document.documentElement)
		.getPropertyValue("--ease-out")
		.trim() || fallbackEasing;

const prefersReducedMotion = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * A native <details> that opens and closes with a height, fade and slide
 * animation. It uses the Web Animations API, so it works in every browser.
 * Keyboard and screen reader behavior stay those of <details>/<summary>.
 */
export const AnimatedDetails = ({
	summary,
	children,
	className,
	summaryClassName,
	defaultOpen,
}: AnimatedDetailsProps) => {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const summaryRef = useRef<HTMLElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const runningRef = useRef<Animation[]>([]);
	const isClosingRef = useRef(false);

	const stopRunning = () => {
		for (const animation of runningRef.current) animation.cancel();
		runningRef.current = [];
	};

	useEffect(
		() => () => {
			for (const animation of runningRef.current) animation.cancel();
		},
		[],
	);

	const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
		event.preventDefault();
		const details = detailsRef.current;
		const content = contentRef.current;
		const summaryElement = summaryRef.current;
		if (!details || !content || !summaryElement) return;

		const willOpen = !details.open || isClosingRef.current;
		if (prefersReducedMotion()) {
			stopRunning();
			isClosingRef.current = false;
			details.open = willOpen;
			return;
		}

		// Measure the current state first, so a click mid-animation reverses from here.
		const startHeight = details.getBoundingClientRect().height;
		const contentStyle = getComputedStyle(content);
		const startOpacity = contentStyle.opacity;
		const startTransform = contentStyle.transform;

		stopRunning();
		details.open = true;
		const fullHeight = details.getBoundingClientRect().height;
		const closedHeight = fullHeight - content.getBoundingClientRect().height;
		const endHeight = willOpen ? fullHeight : closedHeight;
		isClosingRef.current = !willOpen;

		const timing: KeyframeAnimationOptions = {
			duration: durationMs,
			easing: readEasing(),
			fill: "forwards",
		};
		const heightAnimation = details.animate(
			[
				{ height: `${startHeight}px`, overflow: "hidden" },
				{ height: `${endHeight}px`, overflow: "hidden" },
			],
			timing,
		);
		const contentAnimation = content.animate(
			[
				{ opacity: startOpacity, transform: startTransform },
				willOpen
					? { opacity: 1, transform: "translateY(0)" }
					: { opacity: 0, transform: `translateY(${slideOffset})` },
			],
			timing,
		);
		runningRef.current = [heightAnimation, contentAnimation];

		heightAnimation.onfinish = () => {
			if (!willOpen) details.open = false;
			isClosingRef.current = false;
			stopRunning();
		};
	};

	return (
		<details ref={detailsRef} className={className} open={defaultOpen}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: <summary> is natively interactive; the click only adds the animation. */}
			<summary
				ref={summaryRef}
				className={summaryClassName}
				onClick={handleSummaryClick}
			>
				{summary}
			</summary>
			<div ref={contentRef}>{children}</div>
		</details>
	);
};
