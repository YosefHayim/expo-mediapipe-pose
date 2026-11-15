import { useRef } from "react";
import type { HeroLandmarks } from "@/landing/hero/hero-landmarks-schema";
import { useInView } from "@/landing/motion/reveal";
import type { PreviewKind } from "./paint-gallery-preview";
import { useGalleryPreview } from "./use-gallery-preview";

interface GalleryPreviewProps {
	kind: PreviewKind;
	landmarks: HeroLandmarks | null;
	label: string;
}

export const GalleryPreview = ({
	kind,
	landmarks,
	label,
}: GalleryPreviewProps) => {
	const plateRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const isInView = useInView(plateRef);
	useGalleryPreview({ canvasRef, kind, landmarks, isInView });

	return (
		<div ref={plateRef} className="gallery-preview-plate">
			<canvas
				ref={canvasRef}
				className="gallery-preview-canvas"
				role="img"
				aria-label={label}
			/>
		</div>
	);
};
