import { base } from "@/site";

export const SiteFooter = () => {
	return (
		<footer>
			<span>expo-mediapipe-pose · Community-maintained</span>
			<div>
				<a href={`${base}THIRD_PARTY_NOTICES.md`}>
					MediaPipe & sample attribution
				</a>
				<a href={`${base}version.json`}>Build information</a>
			</div>
		</footer>
	);
};
