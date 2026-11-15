import { useRef, useState } from "react";
import { HeroPlaybackButton } from "./hero-playback-button";
import { useHeroLandmarks } from "./use-hero-landmarks";
import { useHeroPlayback } from "./use-hero-playback";
import { useHeroSkeletonDrawing } from "./use-hero-skeleton-drawing";

const mediaUrl = (fileName: string) =>
	`${import.meta.env.BASE_URL}media/${fileName}`;

/** The clip, the recorded skeleton drawn over it, the joint readout and the pause control. */
export const HeroVideoStage = () => {
	const stageRef = useRef<HTMLDivElement>(null);
	const videoRef = useRef<HTMLVideoElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const labelRef = useRef<HTMLDivElement>(null);
	const [isMotionReduced] = useState(
		() => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const landmarks = useHeroLandmarks();
	const { isPausedByPerson, isRunning, togglePausedByPerson } = useHeroPlayback(
		videoRef,
		stageRef,
		isMotionReduced,
	);
	useHeroSkeletonDrawing({
		videoRef,
		canvasRef,
		labelRef,
		landmarks,
		isRunning,
		isMotionReduced,
	});

	return (
		<div ref={stageRef} className="hero-stage">
			<div className="hero-backdrop" aria-hidden="true">
				<video
					ref={videoRef}
					className="hero-video"
					src={mediaUrl("hero-clip.mp4")}
					poster={mediaUrl("hero-clip-poster.jpg")}
					autoPlay={!isMotionReduced}
					muted
					loop
					playsInline
					preload="metadata"
				/>

				<div className="hero-overlay" />

				<canvas ref={canvasRef} className="hero-skeleton" />

				<div
					ref={labelRef}
					className="hero-readout-label"
					data-visible="false"
				/>
			</div>

			<HeroPlaybackButton
				isPlaying={!isPausedByPerson}
				onToggle={togglePausedByPerson}
			/>
		</div>
	);
};
