import { HeroPlaybackIcon } from "./hero-playback-icon";

interface HeroPlaybackButtonProps {
	isPlaying: boolean;
	onToggle: () => void;
}

export const HeroPlaybackButton = ({
	isPlaying,
	onToggle,
}: HeroPlaybackButtonProps) => (
	<button
		type="button"
		className="hero-playback"
		aria-label={
			isPlaying ? "Pause the background video" : "Play the background video"
		}
		onClick={onToggle}
	>
		<HeroPlaybackIcon isPlaying={isPlaying} />
	</button>
);
