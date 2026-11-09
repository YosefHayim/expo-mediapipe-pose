import { useEffect, useRef } from "react";
import type { BrowserMask } from "@/types";

interface MaskCanvasProps {
	mask: BrowserMask | undefined;
	color: string;
	opacity: number;
}

export const MaskCanvas = ({ mask, color, opacity }: MaskCanvasProps) => {
	const ref = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		const canvas = ref.current;

		const isMaskOrCanvasMissing = mask == null || canvas == null;
		if (isMaskOrCanvasMissing) return;

		canvas.width = mask.width;
		canvas.height = mask.height;

		const context = canvas.getContext("2d");

		const isDrawingMissing = context == null;
		if (isDrawingMissing) return;

		const pixels = context.createImageData(mask.width, mask.height);
		const rgb = [1, 3, 5].map((offset) =>
			Number.parseInt(color.slice(offset, offset + 2), 16),
		);
		mask.values.forEach((value, index) => {
			pixels.data[index * 4] = rgb[0] ?? 0;
			pixels.data[index * 4 + 1] = rgb[1] ?? 0;
			pixels.data[index * 4 + 2] = rgb[2] ?? 0;
			pixels.data[index * 4 + 3] = value;
		});
		context.putImageData(pixels, 0, 0);
	}, [mask, color]);
	const isMaskPresent = mask !== undefined;
	return isMaskPresent ? (
		<canvas
			ref={ref}
			className="mask"
			style={{ opacity }}
			aria-label="Selected pose segmentation mask"
		/>
	) : null;
};
