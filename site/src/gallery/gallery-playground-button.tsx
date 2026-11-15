import { ArrowRightIcon } from "@/landing/icons/icons";
import { openPlayground } from "@/landing/open-playground";
import type { MediaMode } from "@/playground/types";

interface GalleryPlaygroundButtonProps {
	cardTitle: string;
	preset: string;
	mode: MediaMode;
}

export const GalleryPlaygroundButton = ({
	cardTitle,
	preset,
	mode,
}: GalleryPlaygroundButtonProps) => {
	const handleOpenClick = () => openPlayground({ preset, mode });

	return (
		<button
			type="button"
			className="gallery-card-button"
			aria-label={`Open ${cardTitle} in the playground`}
			onClick={handleOpenClick}
		>
			<span>Open in playground</span>
			<ArrowRightIcon size={18} />
		</button>
	);
};
