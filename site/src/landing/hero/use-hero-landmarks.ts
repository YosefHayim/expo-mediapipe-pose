import { useEffect, useState } from "react";
import {
	type HeroLandmarks,
	heroLandmarksSchema,
} from "./hero-landmarks-schema";

let sharedLandmarksPromise: Promise<HeroLandmarks | null> | null = null;

const loadLandmarksOnce = () => {
	sharedLandmarksPromise ??= fetch(
		`${import.meta.env.BASE_URL}media/hero-landmarks.json`,
	)
		.then((landmarksReply) => landmarksReply.json())
		.then((landmarksJson: unknown) => heroLandmarksSchema.parse(landmarksJson))
		.catch((error) => {
			console.error({ message: "The hero landmarks failed to load.", error });
			return null;
		});
	return sharedLandmarksPromise;
};

/** Every caller shares one fetch of the recording per page load. */
export const useHeroLandmarks = () => {
	const [landmarks, setLandmarks] = useState<HeroLandmarks | null>(null);

	useEffect(() => {
		let isCancelled = false;
		loadLandmarksOnce().then((loadedLandmarks) => {
			if (!isCancelled) setLandmarks(loadedLandmarks);
		});

		return () => {
			isCancelled = true;
		};
	}, []);

	return landmarks;
};
