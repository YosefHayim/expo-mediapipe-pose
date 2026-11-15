import { useEffect, useState } from "react";
import {
	type HeroLandmarks,
	heroLandmarksSchema,
} from "./hero-landmarks-schema";

export const useHeroLandmarks = () => {
	const [landmarks, setLandmarks] = useState<HeroLandmarks | null>(null);

	useEffect(() => {
		const abortController = new AbortController();

		const loadLandmarks = async () => {
			try {
				const landmarksReply = await fetch(
					`${import.meta.env.BASE_URL}media/hero-landmarks.json`,
					{ signal: abortController.signal },
				);
				const landmarksJson: unknown = await landmarksReply.json();
				setLandmarks(heroLandmarksSchema.parse(landmarksJson));
			} catch (error) {
				const isAborted = abortController.signal.aborted;
				if (isAborted) return;

				console.error({ message: "The hero landmarks failed to load.", error });
			}
		};
		loadLandmarks();

		return () => abortController.abort();
	}, []);

	return landmarks;
};
