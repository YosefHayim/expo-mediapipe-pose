import { type RefObject, useEffect, useRef } from "react";
import type { HeroLandmarks } from "./hero-landmarks-schema";
import { pickDrawInProgress, pickFrameIndex } from "./hero-skeleton-logic";
import { paintHeroSkeleton, type ReadoutPose } from "./paint-hero-skeleton";

interface HeroSkeletonDrawingParts {
	videoRef: RefObject<HTMLVideoElement | null>;
	canvasRef: RefObject<HTMLCanvasElement | null>;
	labelRef: RefObject<HTMLDivElement | null>;
	landmarks: HeroLandmarks | null;
	isRunning: boolean;
	isMotionReduced: boolean;
}

const showReadoutLabel = (
	label: HTMLDivElement,
	readout: ReadoutPose | null,
) => {
	const isReadoutHidden = readout == null;
	label.dataset.visible = isReadoutHidden ? "false" : "true";
	if (isReadoutHidden) return;

	const labelText = `LEFT ELBOW ${readout.degrees}°`;
	const isLabelTextOld = label.textContent !== labelText;
	if (isLabelTextOld) label.textContent = labelText;

	const { labelLeft, labelTop } = readout.placement;
	label.style.transform = `translate(${labelLeft}px, ${labelTop}px)`;
};

/** Draws the recorded skeleton for the frame the video shows; draws once when not running. */
export const useHeroSkeletonDrawing = ({
	videoRef,
	canvasRef,
	labelRef,
	landmarks,
	isRunning,
	isMotionReduced,
}: HeroSkeletonDrawingParts) => {
	const drawInStartRef = useRef<number | null>(null);

	useEffect(() => {
		const video = videoRef.current;
		const canvas = canvasRef.current;
		const label = labelRef.current;
		const context = canvas?.getContext("2d");
		const isEverythingReady =
			video != null &&
			canvas != null &&
			label != null &&
			context != null &&
			landmarks != null;
		if (!isEverythingReady) return;

		const canvasStyle = getComputedStyle(canvas);
		const colors = {
			bone: canvasStyle.getPropertyValue("--signal").trim(),
			joint: canvasStyle.getPropertyValue("--joint").trim(),
		};
		const videoSize = { width: landmarks.width, height: landmarks.height };
		let animationFrameId = 0;

		const resizeCanvas = () => {
			const pixelRatio = window.devicePixelRatio;
			canvas.width = Math.round(canvas.clientWidth * pixelRatio);
			canvas.height = Math.round(canvas.clientHeight * pixelRatio);
			context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		};

		const drawCurrentFrame = (nowMilliseconds: number) => {
			drawInStartRef.current ??= nowMilliseconds;
			const elapsedMilliseconds = isMotionReduced
				? Number.POSITIVE_INFINITY
				: nowMilliseconds - drawInStartRef.current;
			const frameIndex = pickFrameIndex(
				video.currentTime,
				landmarks.fps,
				landmarks.frames.length,
			);
			const frame = landmarks.frames[frameIndex] ?? [];
			const readout = paintHeroSkeleton(context, {
				frame,
				videoSize,
				canvasSize: { width: canvas.clientWidth, height: canvas.clientHeight },
				progress: pickDrawInProgress(elapsedMilliseconds),
				colors,
			});
			showReadoutLabel(label, readout);
		};

		const loopFrames = (nowMilliseconds: number) => {
			drawCurrentFrame(nowMilliseconds);
			animationFrameId = requestAnimationFrame(loopFrames);
		};

		const handleResize = () => {
			resizeCanvas();
			if (!isRunning) drawCurrentFrame(performance.now());
		};

		resizeCanvas();
		const resizeObserver = new ResizeObserver(handleResize);
		resizeObserver.observe(canvas);
		video.addEventListener("seeked", handleResize);
		if (isRunning) animationFrameId = requestAnimationFrame(loopFrames);
		else drawCurrentFrame(performance.now());

		return () => {
			cancelAnimationFrame(animationFrameId);
			resizeObserver.disconnect();
			video.removeEventListener("seeked", handleResize);
		};
	}, [videoRef, canvasRef, labelRef, landmarks, isRunning, isMotionReduced]);
};
