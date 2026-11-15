import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@/landing/icons/icons";
import {
	type OpenPlaygroundOptions,
	openPlaygroundEventName,
} from "@/landing/open-playground";
import { Section } from "@/landing/section/section";
import { type PlaygroundRequest, PlaygroundWorkspace } from "@/playground/app";
import type { IntegrationState } from "@/playground/screen/integration-section";
import { base } from "@/playground/site";
import "./playground-section.css";

type PlaygroundSectionProps = {
	onIntegrationChange: (state: IntegrationState) => void;
};

/** A shared link carries its setup in the address, so it loads at once. */
const hasSharedConfiguration = () =>
	new URLSearchParams(window.location.hash.slice(1)).has("config");

export const PlaygroundSection = ({
	onIntegrationChange,
}: PlaygroundSectionProps) => {
	const sectionRef = useRef<HTMLDivElement>(null);
	const [isLoaded, setIsLoaded] = useState(hasSharedConfiguration);
	const [request, setRequest] = useState<PlaygroundRequest | null>(null);

	const loadPlayground = useCallback(() => setIsLoaded(true), []);

	useEffect(() => {
		if (isLoaded) return;
		const element = sectionRef.current;
		if (element === null) return;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry?.isIntersecting) setIsLoaded(true);
			},
			{ rootMargin: "600px 0px" },
		);
		observer.observe(element);
		return () => observer.disconnect();
	}, [isLoaded]);

	useEffect(() => {
		const handleOpen = (event: Event) => {
			const options = (event as CustomEvent<OpenPlaygroundOptions>).detail;
			setIsLoaded(true);
			setRequest((previous) => ({
				...options,
				id: (previous?.id ?? 0) + 1,
			}));
		};
		window.addEventListener(openPlaygroundEventName, handleOpen);
		return () =>
			window.removeEventListener(openPlaygroundEventName, handleOpen);
	}, []);

	return (
		<Section
			id="playground"
			ground="night"
			title="Try it on your own movement."
			intro="Pick a sample, your camera or a local file. Change the skeleton, add feedback rules, then copy the Expo code. Everything runs in your browser; frames never leave it."
		>
			<div ref={sectionRef} className="playground-frame">
				{isLoaded ? (
					<PlaygroundWorkspace
						request={request}
						onIntegrationChange={onIntegrationChange}
					/>
				) : (
					<div className="playground-placeholder">
						<img
							src={`${base}pose.jpg`}
							alt="A person standing in a pose, the sample the playground starts with."
							width={1000}
							height={667}
							loading="lazy"
						/>
						<div className="playground-placeholder-panel">
							<p className="lead">
								The pose model and its worker load only when you ask for them.
							</p>
							<button
								type="button"
								className="button-primary"
								onClick={loadPlayground}
							>
								Load the live playground
								<ArrowRightIcon size={18} />
							</button>
						</div>
					</div>
				)}
			</div>
		</Section>
	);
};
