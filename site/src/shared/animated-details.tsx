import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";

const durationMilliseconds = 320;
const slideOffset = "-8px";
const fallbackEasing = "cubic-bezier(0.22, 1, 0.36, 1)";

const readEasing = () =>
	getComputedStyle(document.documentElement)
		.getPropertyValue("--ease-out")
		.trim() || fallbackEasing;

const isReducedMotionPreferred = () =>
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface AnimatedDetailsProps {
	summary: ReactNode;
	children: ReactNode;
	className?: string;
	summaryClassName?: string;
	defaultOpen?: boolean;
}

export const AnimatedDetails = ({
	summary,
	children,
	className,
	summaryClassName,
	defaultOpen,
}: AnimatedDetailsProps) => {
	const detailsRef = useRef<HTMLDetailsElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const runningAnimationsRef = useRef<Animation[]>([]);
	const isClosingRef = useRef(false);

	const stopRunningAnimations = () => {
		for (const animation of runningAnimationsRef.current) animation.cancel();
		runningAnimationsRef.current = [];
	};

	useEffect(
		() => () => {
			for (const animation of runningAnimationsRef.current) animation.cancel();
		},
		[],
	);

	const handleSummaryClick = (event: MouseEvent<HTMLElement>) => {
		event.preventDefault();
		const details = detailsRef.current;
		const content = contentRef.current;
		const isNotMounted = details == null || content == null;

		if (isNotMounted) return;

		const willOpen = !details.open || isClosingRef.current;

		if (isReducedMotionPreferred()) {
			stopRunningAnimations();
			isClosingRef.current = false;
			details.open = willOpen;
			return;
		}

		// Measure first, so a click mid-animation reverses from here. Closed content still reports opacity 1.
		const wasFullyClosed = !details.open;
		const startHeight = details.getBoundingClientRect().height;
		const contentStyle = getComputedStyle(content);
		const startOpacity = wasFullyClosed ? "0" : contentStyle.opacity;
		const closedTransform = `translateY(${slideOffset})`;
		const startTransform = wasFullyClosed
			? closedTransform
			: contentStyle.transform;

		stopRunningAnimations();
		details.open = true;
		const fullHeight = details.getBoundingClientRect().height;
		const closedHeight = fullHeight - content.getBoundingClientRect().height;
		const endHeight = willOpen ? fullHeight : closedHeight;
		const endFrame = willOpen
			? { opacity: 1, transform: "translateY(0)" }
			: { opacity: 0, transform: closedTransform };
		isClosingRef.current = !willOpen;

		const timing: KeyframeAnimationOptions = {
			duration: durationMilliseconds,
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
			[{ opacity: startOpacity, transform: startTransform }, endFrame],
			timing,
		);
		runningAnimationsRef.current = [heightAnimation, contentAnimation];

		heightAnimation.onfinish = () => {
			details.open = willOpen;
			isClosingRef.current = false;
			stopRunningAnimations();
		};
	};

	return (
		<details ref={detailsRef} className={className} open={defaultOpen}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: <summary> is natively interactive; the click only adds the animation. */}
			<summary className={summaryClassName} onClick={handleSummaryClick}>
				{summary}
			</summary>

			<div ref={contentRef}>{children}</div>
		</details>
	);
};
