import type { HeroLandmarks } from "@/landing/hero/hero-landmarks-schema";
import { GalleryCard } from "./gallery-card";
import type { GalleryGroup as GalleryGroupContent } from "./gallery-groups";

interface GalleryGroupProps {
	group: GalleryGroupContent;
	landmarks: HeroLandmarks | null;
}

export const GalleryGroup = ({ group, landmarks }: GalleryGroupProps) => {
	const titleId = `gallery-group-${group.id}`;

	return (
		<section className="gallery-group" aria-labelledby={titleId}>
			<h3 id={titleId} className="gallery-group-title">
				{group.title}
			</h3>
			<ul className="feature-gallery-grid">
				{group.cards.map((card, cardIndex) => (
					<GalleryCard
						key={card.id}
						card={card}
						landmarks={landmarks}
						revealStep={cardIndex}
					/>
				))}
			</ul>
		</section>
	);
};
