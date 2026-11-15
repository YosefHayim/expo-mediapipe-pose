import {
	type CSSProperties,
	type ElementType,
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import "./reveal.css";

type Callback = (entry: IntersectionObserverEntry) => void;

const revealOptions: IntersectionObserverInit = {
	threshold: 0.15,
	rootMargin: "0px 0px -8% 0px",
};

let sharedObserver: IntersectionObserver | null = null;
const revealCallbacks = new Map<Element, Callback>();

const getSharedObserver = (): IntersectionObserver => {
	sharedObserver ??= new IntersectionObserver((entries) => {
		for (const entry of entries) revealCallbacks.get(entry.target)?.(entry);
	}, revealOptions);
	return sharedObserver;
};

const watchOnce = (element: Element, onIntersect: () => void) => {
	const observer = getSharedObserver();
	revealCallbacks.set(element, (entry) => {
		if (!entry.isIntersecting) return;
		onIntersect();
		observer.unobserve(element);
		revealCallbacks.delete(element);
	});
	observer.observe(element);
	return () => {
		observer.unobserve(element);
		revealCallbacks.delete(element);
	};
};

type RevealProps = {
	as?: ElementType;
	/** Position inside a group; each step adds 0.08s of delay. */
	delay?: number;
	className?: string;
	children: ReactNode;
};

export const Reveal = ({
	as: Tag = "div",
	delay = 0,
	className,
	children,
}: RevealProps) => {
	const ref = useRef<HTMLElement>(null);

	useEffect(() => {
		const element = ref.current;
		if (element === null) return;
		return watchOnce(element, () => element.classList.add("is-visible"));
	}, []);

	const style = { "--reveal-index": delay } as CSSProperties;
	return (
		<Tag
			ref={ref}
			className={className ? `reveal ${className}` : "reveal"}
			style={style}
		>
			{children}
		</Tag>
	);
};

type UseInViewOptions = {
	/** Stop watching after the first time the element is seen. */
	once?: boolean;
	threshold?: number;
	rootMargin?: string;
};

/** True while the element is on screen (or once it has been, with `once`). */
export const useInView = (
	ref: RefObject<Element | null>,
	{ once = false, threshold = 0, rootMargin = "0px" }: UseInViewOptions = {},
) => {
	const [isInView, setIsInView] = useState(false);

	useEffect(() => {
		const element = ref.current;
		if (element === null) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry === undefined) return;
				setIsInView(entry.isIntersecting);
				if (entry.isIntersecting && once) observer.disconnect();
			},
			{ threshold, rootMargin },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [ref, once, threshold, rootMargin]);

	return isInView;
};
