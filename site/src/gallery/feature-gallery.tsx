import { useHeroLandmarks } from "@/landing/hero/use-hero-landmarks";
import { Section } from "@/landing/section/section";
import { GalleryGroup } from "./gallery-group";
import { GALLERY_GROUPS } from "./gallery-groups";
import "./feature-gallery.css";

export const FeatureGallery = () => {
	const landmarks = useHeroLandmarks();

	return (
		<Section
			id="features"
			title="Everything you need to see and use a pose."
			intro="Live camera, photos and video, measured angles, feedback rules and recording, all in one Expo module."
		>
			<div className="feature-gallery">
				{GALLERY_GROUPS.map((group) => (
					<GalleryGroup key={group.id} group={group} landmarks={landmarks} />
				))}
			</div>
			<p className="gallery-note small">
				The previews replay one recorded clip as an illustration. They are not
				live detection.
			</p>
		</Section>
	);
};
