import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@/landing/icons/icons";

const installCommand = "npx expo install expo-mediapipe-pose";
const installCommandStart = "npx expo install";
const installPackageName = "expo-mediapipe-pose";

export const HeroInstallBox = () => {
	const [isCopied, setIsCopied] = useState(false);
	const resetTimer = useRef<number | undefined>(undefined);

	useEffect(() => () => window.clearTimeout(resetTimer.current), []);

	const handleCopyClick = async () => {
		try {
			await navigator.clipboard.writeText(installCommand);
			setIsCopied(true);
			window.clearTimeout(resetTimer.current);
			resetTimer.current = window.setTimeout(() => setIsCopied(false), 2000);
		} catch {
			// The command stays selectable in the box.
		}
	};

	return (
		<div className="hero-install">
			<code>
				{installCommandStart}{" "}
				<span className="hero-install-package">{installPackageName}</span>
			</code>
			<button
				type="button"
				className="hero-install-copy"
				aria-label={isCopied ? "Copied" : "Copy the install command"}
				onClick={handleCopyClick}
			>
				{isCopied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
			</button>
		</div>
	);
};
