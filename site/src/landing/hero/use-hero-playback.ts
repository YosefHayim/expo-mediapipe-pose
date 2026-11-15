import { type RefObject, useEffect, useState } from "react";
import { useInView } from "@/landing/motion/reveal";

/** Plays the clip only while the person wants it, the hero is on screen and the tab is visible. */
export const useHeroPlayback = (
	videoRef: RefObject<HTMLVideoElement | null>,
	stageRef: RefObject<HTMLElement | null>,
	isMotionReduced: boolean,
) => {
	const [isPausedByPerson, setIsPausedByPerson] = useState(isMotionReduced);
	const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
	const isHeroOnScreen = useInView(stageRef);
	const isRunning = !isPausedByPerson && isHeroOnScreen && isTabVisible;

	useEffect(() => {
		const handleVisibilityChange = () => setIsTabVisible(!document.hidden);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibilityChange);
	}, []);

	useEffect(() => {
		const video = videoRef.current;
		if (video == null) return;

		const playVideo = async () => {
			try {
				await video.play();
			} catch (error) {
				console.error({ message: "The hero clip could not play.", error });
			}
		};
		if (isRunning) playVideo();
		else video.pause();
	}, [isRunning, videoRef]);

	const togglePausedByPerson = () =>
		setIsPausedByPerson((isPaused) => !isPaused);

	return { isPausedByPerson, isRunning, togglePausedByPerson };
};
