import { type RefObject, useEffect, useState } from "react";
import type { HeroLandmarks } from "@/landing/hero/hero-landmarks-schema";
import { type PreviewKind, paintGalleryPreview } from "./paint-gallery-preview";
import { readPreviewColors } from "./preview-colors";
import { useIsTabVisible } from "./use-is-tab-visible";

interface GalleryPreviewParts {
	canvasRef: RefObject<HTMLCanvasElement | null>;
	kind: PreviewKind;
	landmarks: HeroLandmarks | null;
	isInView: boolean;
}

const STILL_SHARE_OF_CLIP = 0.35;

/** Replays the recording on the canvas while it is on screen and the tab is visible; otherwise paints one still frame. */
export const useGalleryPreview = ({
	canvasRef,
	kind,
	landmarks,
	isInView,
}: GalleryPreviewParts) => {
	const isTabVisible = useIsTabVisible();
	const [isMotionReduced] = useState(
		() => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);
	const isRunning = isInView && isTabVisible && !isMotionReduced;

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		const isEverythingReady =
			canvas != null && context != null && landmarks != null;
		if (!isEverythingReady) return;

		const colors = readPreviewColors(canvas);
		const stillElapsedMilliseconds = landmarks.durationMs * STILL_SHARE_OF_CLIP;
		const startMilliseconds = performance.now();
		let animationFrameId = 0;

		const resizeCanvas = () => {
			const pixelRatio = window.devicePixelRatio;
			canvas.width = Math.round(canvas.clientWidth * pixelRatio);
			canvas.height = Math.round(canvas.clientHeight * pixelRatio);
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		};

		const paintAt = (elapsedMilliseconds: number) =>
			paintGalleryPreview(context, kind, {
				landmarks,
				colors,
				canvasSize: { width: canvas.clientWidth, height: canvas.clientHeight },
				elapsedMilliseconds,
			});

		const loopFrames = (nowMilliseconds: number) => {
			paintAt(nowMilliseconds - startMilliseconds);
			animationFrameId = requestAnimationFrame(loopFrames);
		};

		const handleResize = () => {
			resizeCanvas();
			if (!isRunning) paintAt(stillElapsedMilliseconds);
		};

		// Resizing clears the canvas, so paint at once instead of waiting a frame.
		const firstElapsedMilliseconds = isRunning ? 0 : stillElapsedMilliseconds;
		resizeCanvas();
		paintAt(firstElapsedMilliseconds);
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(canvas);
		if (isRunning) animationFrameId = requestAnimationFrame(loopFrames);

		return () => {
			cancelAnimationFrame(animationFrameId);
			resizeObserver.disconnect();
		};
	}, [canvasRef, kind, landmarks, isRunning]);
};
