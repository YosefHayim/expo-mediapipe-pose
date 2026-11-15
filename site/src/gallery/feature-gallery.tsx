import { Section } from "@/landing/section/section";
import "./feature-gallery.css";

export const FeatureGallery = () => {
	return (
		<Section
			id="features"
			ground="paper"
			title="Everything you need to see and use a pose."
			intro="Live camera, photos and video, measured angles, feedback rules and recording, all in one Expo module."
		>
			<div className="feature-gallery-grid" />
		</Section>
	);
};
