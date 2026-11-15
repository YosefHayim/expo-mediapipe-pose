import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, CheckIcon, CopyIcon } from "@/landing/icons/icons";
import { openPlayground } from "@/landing/open-playground";
import "./hero.css";

const installCommand = "npx expo install expo-mediapipe-pose";

export const Hero = () => {
	const [isCopied, setIsCopied] = useState(false);
	const resetTimer = useRef<number | undefined>(undefined);

	useEffect(() => () => window.clearTimeout(resetTimer.current), []);

	const handleTryClick = () => openPlayground();

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
		<section
			id="top"
			className="hero ground-night"
			aria-labelledby="hero-title"
		>
			<div className="container hero-inner">
				<div className="hero-group-one">
					<h1 id="hero-title">Track every joint, live in Expo.</h1>
					<span className="hero-rule" aria-hidden="true" />
					<p className="lead hero-lead">
						On-device pose detection for Expo and React Native, powered by
						MediaPipe. Camera, photo and video inference with custom skeletons
						and your own feedback rules. Frames stay on the device.
					</p>
				</div>
				<div className="hero-group-two">
					<button
						type="button"
						className="button-primary"
						onClick={handleTryClick}
					>
						Try it live
						<ArrowRightIcon size={18} />
					</button>
					<div className="hero-install">
						<code>{installCommand}</code>
						<button
							type="button"
							className="hero-install-copy"
							aria-label={isCopied ? "Copied" : "Copy the install command"}
							onClick={handleCopyClick}
						>
							{isCopied ? <CheckIcon size={20} /> : <CopyIcon size={20} />}
						</button>
					</div>
				</div>
			</div>
		</section>
	);
};
