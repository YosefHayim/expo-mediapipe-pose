import { useRef } from "react";
import type { HeroLandmarks } from "@/landing/hero/hero-landmarks-schema";
import { Reveal, useInView } from "@/landing/motion/reveal";
import type { GalleryCard as GalleryCardContent } from "./gallery-groups";
import { GalleryPlaygroundButton } from "./gallery-playground-button";
import { GalleryPreview } from "./gallery-preview";

interface GalleryCardProps {
	card: GalleryCardContent;
	landmarks: HeroLandmarks | null;
	revealStep: number;
}

export const GalleryCard = ({
	card,
	landmarks,
	revealStep,
}: GalleryCardProps) => {
	const bodyRef = useRef<HTMLDivElement>(null);
	const isSeen = useInView(bodyRef, { once: true, threshold: 0.3 });
	const CardIcon = card.icon;

	return (
		<Reveal as="li" delay={revealStep} className="gallery-card">
			<div ref={bodyRef} className="gallery-card-body" data-seen={isSeen}>
				<GalleryPreview
					kind={card.previewKind}
					landmarks={landmarks}
					label={`${card.title} illustration`}
				/>
				<CardIcon size={28} className="gallery-card-icon" />
				<h4 className="gallery-card-title">{card.title}</h4>
				<p className="gallery-card-text">{card.text}</p>
				<GalleryPlaygroundButton
					cardTitle={card.title}
					preset={card.playgroundPreset}
					mode={card.playgroundMode}
				/>
			</div>
		</Reveal>
	);
};
