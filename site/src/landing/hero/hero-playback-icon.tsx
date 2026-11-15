interface HeroPlaybackIconProps {
	isPlaying: boolean;
}

export const HeroPlaybackIcon = ({ isPlaying }: HeroPlaybackIconProps) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		width={20}
		height={20}
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		strokeWidth={1.75}
		strokeLinecap="round"
		strokeLinejoin="round"
		aria-hidden="true"
		focusable="false"
	>
		<path d={isPlaying ? "M9 5v14M15 5v14" : "M8 5.5v13l11-6.5z"} />
	</svg>
);
